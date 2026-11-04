-- ============================================================
-- СХЕМА БАЗЫ ДАННЫХ И МИГРАЦИИ: МИНИ-CRM «ОБЪЕКТЫ И ЗАДАЧИ»
-- ============================================================

-- 1. Пользовательские типы (ENUM)
DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('Новая', 'В работе', 'На проверке', 'Принята', 'На доработке');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE user_role_type AS ENUM ('manager', 'worker');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Таблица ролей пользователей (связь с auth.users)
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role_type NOT NULL
);

-- 3. Таблица строительных объектов
CREATE TABLE IF NOT EXISTS objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Таблица задач
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    object_id UUID NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES auth.users(id),
    manager_id UUID REFERENCES auth.users(id) NOT NULL,
    status task_status DEFAULT 'Новая' NOT NULL,
    last_comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Таблица истории (иммутабельная)
CREATE TABLE IF NOT EXISTS task_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES auth.users(id),
    old_status task_status,
    new_status task_status NOT NULL,
    comment TEXT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- БЕЗОПАСНОСТЬ: ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;

-- 2.1 user_roles
DROP POLICY IF EXISTS "Роли видны всем" ON user_roles;
CREATE POLICY "Роли видны всем" ON user_roles 
FOR SELECT TO authenticated USING (true);

-- 2.2 objects
DROP POLICY IF EXISTS "Просмотр объектов" ON objects;
CREATE POLICY "Просмотр объектов" ON objects 
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'manager')
  OR id IN (SELECT object_id FROM tasks WHERE worker_id = auth.uid())
);

DROP POLICY IF EXISTS "Постановщик управляет объектами" ON objects;
CREATE POLICY "Постановщик управляет объектами" ON objects 
FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'manager')
);

-- 2.3 tasks
DROP POLICY IF EXISTS "Просмотр задач" ON tasks;
CREATE POLICY "Просмотр задач" ON tasks 
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'manager')
  OR worker_id = auth.uid()
);

DROP POLICY IF EXISTS "Постановщик создает задачи" ON tasks;
CREATE POLICY "Постановщик создает задачи" ON tasks 
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'manager')
);

DROP POLICY IF EXISTS "Постановщик удаляет задачи" ON tasks;
CREATE POLICY "Постановщик удаляет задачи" ON tasks 
FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'manager')
);

DROP POLICY IF EXISTS "Изменение задач" ON tasks;
CREATE POLICY "Изменение задач" ON tasks 
FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'manager')
  OR worker_id = auth.uid()
);

-- 2.4 task_history
DROP POLICY IF EXISTS "Просмотр истории" ON task_history;
CREATE POLICY "Просмотр истории" ON task_history 
FOR SELECT TO authenticated USING (true);

-- ============================================================
-- БИЗНЕС-ЛОГИКА: ТРИГГЕРЫ ПРОВЕРКИ ПЕРЕХОДОВ И ЗАПИСИ В ИСТОРИЮ
-- ============================================================

CREATE OR REPLACE FUNCTION check_status_and_log_history()
RETURNS TRIGGER AS $$
DECLARE
  my_role user_role_type;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT role INTO my_role FROM user_roles WHERE user_id = auth.uid();

  -- Проверка разрешенных переходов (строго по ТЗ)
  IF OLD.status = 'Новая' AND NEW.status = 'В работе' AND my_role = 'worker' AND OLD.worker_id = auth.uid() THEN
    -- ОК
  ELSIF OLD.status = 'В работе' AND NEW.status = 'На проверке' AND my_role = 'worker' AND OLD.worker_id = auth.uid() THEN
    -- ОК
  ELSIF OLD.status = 'На проверке' AND NEW.status = 'Принята' AND my_role = 'manager' THEN
    -- ОК
  ELSIF OLD.status = 'На проверке' AND NEW.status = 'На доработке' AND my_role = 'manager' THEN
    IF NEW.last_comment IS NULL OR trim(NEW.last_comment) = '' THEN
      RAISE EXCEPTION 'При возврате на доработку обязателен комментарий!';
    END IF;
  ELSIF OLD.status = 'На доработке' AND NEW.status = 'В работе' AND my_role = 'worker' AND OLD.worker_id = auth.uid() THEN
    -- ОК
  ELSE
    RAISE EXCEPTION 'Недопустимый переход статуса из "%" в "%" для вашей роли', OLD.status, NEW.status;
  END IF;

  -- Автоматическая запись в историю
  INSERT INTO task_history (task_id, changed_by, old_status, new_status, comment)
  VALUES (NEW.id, auth.uid(), OLD.status, NEW.status, NEW.last_comment);

  NEW.last_comment := NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_task_status ON tasks;
CREATE TRIGGER trg_task_status
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION check_status_and_log_history();

-- Автоматическая запись создания задачи
CREATE OR REPLACE FUNCTION log_task_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO task_history (task_id, changed_by, old_status, new_status, comment)
  VALUES (NEW.id, auth.uid(), NULL, NEW.status, 'Задача создана');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_task_creation ON tasks;
CREATE TRIGGER trg_task_creation
AFTER INSERT ON tasks
FOR EACH ROW
EXECUTE FUNCTION log_task_created();

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Typography,
  Table,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Spin,
  message,
  Breadcrumb,
  Empty,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  ArrowLeftOutlined,
  EnvironmentOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { StatusTag } from '../components/StatusTag';
import type { BuildingObject, Task, TaskStatus, UserRoleItem } from '../types';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export const ObjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role, user } = useAuth();

  const [objectData, setObjectData] = useState<BuildingObject | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workers, setWorkers] = useState<UserRoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [createTaskLoading, setCreateTaskLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [form] = Form.useForm();

  const isManager = role === 'manager';

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // 1. Загрузка данных объекта
      const { data: objData, error: objError } = await supabase
        .from('objects')
        .select('*')
        .eq('id', id)
        .single();

      if (objError) {
        message.error('Ошибка загрузки объекта: ' + objError.message);
        return;
      }
      setObjectData(objData);

      // 2. Загрузка задач по этому объекту
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('object_id', id)
        .order('created_at', { ascending: false });

      if (tasksError) {
        message.error('Ошибка загрузки задач: ' + tasksError.message);
      } else {
        setTasks(tasksData || []);
      }

      // 3. Если постановщик — загружаем список исполнителей для выпадающего списка
      if (isManager) {
        const { data: workersData } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .eq('role', 'worker');

        setWorkers(workersData || []);
      }
    } catch (e: unknown) {
      if (e instanceof Error) message.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, role]);

  const handleCreateTask = async (values: {
    title: string;
    description?: string;
    worker_id: string;
  }) => {
    if (!id || !user) return;
    setCreateTaskLoading(true);

    try {
      const { error } = await supabase.from('tasks').insert([
        {
          title: values.title.trim(),
          description: values.description ? values.description.trim() : null,
          object_id: id,
          worker_id: values.worker_id,
          manager_id: user.id,
          status: 'Новая',
        },
      ]);

      if (error) {
        message.error('Не удалось создать задачу: ' + error.message);
      } else {
        message.success('Задача успешно создана');
        setIsTaskModalOpen(false);
        form.resetFields();
        loadData();
      }
    } catch (e: unknown) {
      if (e instanceof Error) message.error(e.message);
    } finally {
      setCreateTaskLoading(false);
    }
  };

  const handleDeleteTask = async (taskId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) {
        message.error('Не удалось удалить задачу: ' + error.message);
      } else {
        message.success('Задача удалена');
        loadData();
      }
    } catch (err: unknown) {
      if (err instanceof Error) message.error(err.message);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (selectedStatus === 'all') return true;
    return t.status === selectedStatus;
  });

  const columns = [
    {
      title: 'Название задачи',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: Task) => (
        <a
          onClick={() => navigate(`/tasks/${record.id}`)}
          style={{ fontWeight: 600, color: '#1677ff' }}
        >
          {text}
        </a>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: TaskStatus) => <StatusTag status={status} />,
    },
    {
      title: 'Исполнитель',
      dataIndex: 'worker_id',
      key: 'worker_id',
      render: (workerId: string | null) => {
        if (!workerId) return <Text type="secondary">Не назначен</Text>;
        const shortId = workerId.slice(0, 8);
        return <Tag>ID: {shortId}...</Tag>;
      },
    },
    {
      title: 'Создана',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (dateStr: string) => new Date(dateStr).toLocaleDateString('ru-RU'),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: Task) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/tasks/${record.id}`)}
          />
          {isManager && (
            <Popconfirm
              title="Удалить задачу?"
              okText="Да"
              cancelText="Нет"
              okButtonProps={{ danger: true }}
              onConfirm={(e) => handleDeleteTask(record.id, e)}
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!objectData) {
    return (
      <Card style={{ textAlign: 'center', padding: '40px 0' }}>
        <Empty description="Объект не найден или у вас нет к нему доступа" />
        <Button onClick={() => navigate('/objects')} style={{ marginTop: 16 }}>
          Вернуться к списку
        </Button>
      </Card>
    );
  }

  return (
    <div>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <a onClick={() => navigate('/objects')}>Объекты</a> },
          { title: objectData.name },
        ]}
      />

      <Card style={{ marginBottom: 24, borderRadius: 12 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/objects')}
              style={{ paddingLeft: 0, marginBottom: 8 }}
            >
              Назад к объектам
            </Button>
            <Title level={2} style={{ margin: '0 0 8px 0' }}>
              {objectData.name}
            </Title>
            <Paragraph
              type="secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15 }}
            >
              <EnvironmentOutlined style={{ color: '#1677ff' }} />
              {objectData.address}
            </Paragraph>
          </div>

          {isManager && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              onClick={() => setIsTaskModalOpen(true)}
            >
              Создать задачу
            </Button>
          )}
        </div>
      </Card>

      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span>Список задач объекта ({tasks.length})</span>
            <Select
              value={selectedStatus}
              onChange={setSelectedStatus}
              style={{ width: 180 }}
              options={[
                { value: 'all', label: 'Все статусы' },
                { value: 'Новая', label: 'Новая' },
                { value: 'В работе', label: 'В работе' },
                { value: 'На проверке', label: 'На проверке' },
                { value: 'Принята', label: 'Принята' },
                { value: 'На доработке', label: 'На доработке' },
              ]}
            />
          </div>
        }
        style={{ borderRadius: 12 }}
      >
        <Table
          dataSource={filteredTasks}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 8 }}
          locale={{
            emptyText: (
              <Empty
                description={
                  isManager
                    ? 'По этому объекту пока нет задач. Создайте первую задачу!'
                    : 'У вас нет задач по этому объекту'
                }
              />
            ),
          }}
        />
      </Card>

      {/* Модальное окно создания задачи (для постановщика) */}
      <Modal
        title="Создание задачи по объекту"
        open={isTaskModalOpen}
        onCancel={() => {
          setIsTaskModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateTask}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="title"
            label="Название задачи"
            rules={[{ required: true, message: 'Введите название задачи' }]}
          >
            <Input placeholder="Например: Залить фундамент 2-й очереди" />
          </Form.Item>

          <Form.Item name="description" label="Описание / ТЗ">
            <TextArea
              rows={4}
              placeholder="Подробности задачи, материалы, требования..."
            />
          </Form.Item>

          <Form.Item
            name="worker_id"
            label="Назначить исполнителя"
            rules={[{ required: true, message: 'Выберите исполнителя' }]}
          >
            <Select
              placeholder="Выберите рабочего из списка"
              options={workers.map((w) => ({
                value: w.user_id,
                label: `Исполнитель (ID: ${w.user_id.slice(0, 8)}...)`,
              }))}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsTaskModalOpen(false)}>Отмена</Button>
              <Button type="primary" htmlType="submit" loading={createTaskLoading}>
                Создать задачу
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

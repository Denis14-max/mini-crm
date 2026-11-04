import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Typography,
  Descriptions,
  Timeline,
  Modal,
  Form,
  Input,
  Space,
  Spin,
  message,
  Breadcrumb,
  Empty,
  Tag,
  Alert,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
  SendOutlined,
  RollbackOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { StatusTag } from '../components/StatusTag';
import type { Task, TaskHistory, BuildingObject, TaskStatus } from '../types';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export const TaskDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const [task, setTask] = useState<Task | null>(null);
  const [objectData, setObjectData] = useState<BuildingObject | null>(null);
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Для модального окна "Вернуть на доработку" с обязательным комментарием
  const [isReworkModalOpen, setIsReworkModalOpen] = useState(false);
  const [reworkComment, setReworkComment] = useState('');
  const [reworkError, setReworkError] = useState<string | null>(null);

  const isManager = role === 'manager';
  const isAssignedWorker = user?.id === task?.worker_id;

  const loadTaskData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // 1. Загрузка задачи
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single();

      if (taskError) {
        message.error('Ошибка загрузки задачи: ' + taskError.message);
        return;
      }
      setTask(taskData);

      // 2. Загрузка объекта, к которому привязана задача
      if (taskData.object_id) {
        const { data: objData } = await supabase
          .from('objects')
          .select('*')
          .eq('id', taskData.object_id)
          .single();
        setObjectData(objData);
      }

      // 3. Загрузка истории изменений задачи
      const { data: histData, error: histError } = await supabase
        .from('task_history')
        .select('*')
        .eq('task_id', id)
        .order('changed_at', { ascending: false });

      if (histError) {
        console.error('Ошибка истории:', histError);
      } else {
        setHistory(histData || []);
      }
    } catch (e: unknown) {
      if (e instanceof Error) message.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTaskData();
  }, [id, user]);

  // Функция смены статуса задачи
  const handleStatusChange = async (newStatus: TaskStatus, comment?: string) => {
    if (!task) return;
    setActionLoading(true);

    try {
      const updatePayload: { status: TaskStatus; last_comment?: string | null } = {
        status: newStatus,
      };

      if (comment) {
        updatePayload.last_comment = comment.trim();
      }

      const { error } = await supabase
        .from('tasks')
        .update(updatePayload)
        .eq('id', task.id);

      if (error) {
        message.error('Ошибка смены статуса: ' + error.message);
      } else {
        message.success(`Статус успешно изменен на «${newStatus}»`);
        setIsReworkModalOpen(false);
        setReworkComment('');
        setReworkError(null);
        await loadTaskData();
      }
    } catch (err: unknown) {
      if (err instanceof Error) message.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const submitRework = () => {
    if (!reworkComment.trim()) {
      setReworkError('По ТЗ комментарий обязателен при возврате на доработку!');
      return;
    }
    handleStatusChange('На доработке', reworkComment);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!task) {
    return (
      <Card style={{ textAlign: 'center', padding: '40px 0' }}>
        <Empty description="Задача не найдена или у вас нет к ней доступа" />
        <Button onClick={() => navigate('/objects')} style={{ marginTop: 16 }}>
          К списку объектов
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
          ...(objectData
            ? [
                {
                  title: (
                    <a onClick={() => navigate(`/objects/${objectData.id}`)}>
                      {objectData.name}
                    </a>
                  ),
                },
              ]
            : []),
          { title: task.title },
        ]}
      />

      <div style={{ marginBottom: 16 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => {
            if (objectData) navigate(`/objects/${objectData.id}`);
            else navigate('/objects');
          }}
          style={{ paddingLeft: 0 }}
        >
          {objectData ? `Назад к «${objectData.name}»` : 'Назад'}
        </Button>
      </div>

      <Card style={{ marginBottom: 24, borderRadius: 12 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 20,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <StatusTag status={task.status} />
              <Text type="secondary" style={{ fontSize: 13 }}>
                Создана: {new Date(task.created_at).toLocaleString('ru-RU')}
              </Text>
            </div>
            <Title level={2} style={{ margin: 0 }}>
              {task.title}
            </Title>
          </div>

          {/* ПАНЕЛЬ ДОСТУПНЫХ ДЕЙСТВИЙ (СТРОГО ПО ТЗ) */}
          <div style={{ background: '#fafafa', padding: '12px 16px', borderRadius: 8, border: '1px solid #f0f0f0' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#8c8c8c', marginBottom: 8, textTransform: 'uppercase' }}>
              Доступные действия
            </div>
            <Space wrap>
              {/* 1. Новая -> В работе (Исполнитель) */}
              {task.status === 'Новая' && isAssignedWorker && (
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  loading={actionLoading}
                  onClick={() => handleStatusChange('В работе')}
                >
                  Взять в работу
                </Button>
              )}

              {/* 2. В работе -> На проверке (Исполнитель) */}
              {task.status === 'В работе' && isAssignedWorker && (
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  loading={actionLoading}
                  onClick={() => handleStatusChange('На проверке')}
                >
                  Отправить на проверку
                </Button>
              )}

              {/* 3. На проверке -> Принята (Постановщик) */}
              {task.status === 'На проверке' && isManager && (
                <Button
                  type="primary"
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                  icon={<CheckCircleOutlined />}
                  loading={actionLoading}
                  onClick={() => handleStatusChange('Принята')}
                >
                  Принять задачу
                </Button>
              )}

              {/* 4. На проверке -> На доработке (Постановщик с обязательным комментарием) */}
              {task.status === 'На проверке' && isManager && (
                <Button
                  danger
                  icon={<RollbackOutlined />}
                  loading={actionLoading}
                  onClick={() => setIsReworkModalOpen(true)}
                >
                  Вернуть на доработку
                </Button>
              )}

              {/* 5. На доработке -> В работе (Исполнитель) */}
              {task.status === 'На доработке' && isAssignedWorker && (
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  loading={actionLoading}
                  onClick={() => handleStatusChange('В работе')}
                >
                  Взять в работу
                </Button>
              )}

              {/* Если действий для текущей роли и статуса нет */}
              {((task.status === 'Новая' && !isAssignedWorker) ||
                (task.status === 'В работе' && !isAssignedWorker) ||
                (task.status === 'На проверке' && !isManager) ||
                (task.status === 'На доработке' && !isAssignedWorker) ||
                task.status === 'Принята') && (
                <Text type="secondary" style={{ fontStyle: 'italic', fontSize: 13 }}>
                  {task.status === 'Принята'
                    ? '🎉 Задача успешно завершена и принята'
                    : isManager
                    ? 'Ожидается действие исполнителя'
                    : 'Ожидается проверка постановщиком'}
                </Text>
              )}
            </Space>
          </div>
        </div>

        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="Объект">
            {objectData?.name || 'Загрузка...'}
          </Descriptions.Item>
          <Descriptions.Item label="Адрес стройки">
            {objectData?.address || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Исполнитель">
            {task.worker_id ? (
              <Tag color={isAssignedWorker ? 'green' : 'default'}>
                {isAssignedWorker ? 'Вы (Исполнитель)' : `ID: ${task.worker_id.slice(0, 8)}...`}
              </Tag>
            ) : (
              <Text type="secondary">Не назначен</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Постановщик (автор)">
            <Tag color={isManager ? 'blue' : 'default'}>
              {user?.id === task.manager_id ? 'Вы (Постановщик)' : `ID: ${task.manager_id.slice(0, 8)}...`}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Описание" span={2}>
            {task.description ? (
              <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                {task.description}
              </Paragraph>
            ) : (
              <Text type="secondary">Описание не указано</Text>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* ТАЙМЛАЙН ИСТОРИИ ИЗМЕНЕНИЙ (ТРЕБОВАНИЕ ТЗ 2.4) */}
      <Card
        title={
          <Space>
            <HistoryOutlined />
            <span>История изменений задачи ({history.length})</span>
          </Space>
        }
        style={{ borderRadius: 12 }}
      >
        {history.length === 0 ? (
          <Empty description="История пока пуста" />
        ) : (
          <Timeline
            style={{ marginTop: 16 }}
            items={history.map((item) => {
              const isCreation = !item.old_status;
              const isCurrentActor = item.changed_by === user?.id;

              return {
                color:
                  item.new_status === 'Принята'
                    ? 'green'
                    : item.new_status === 'На доработке'
                    ? 'red'
                    : 'blue',
                children: (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text strong style={{ fontSize: 14 }}>
                        {isCreation ? (
                          'Создание задачи'
                        ) : (
                          <>
                            {item.old_status} ➔ <StatusTag status={item.new_status} />
                          </>
                        )}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(item.changed_at).toLocaleString('ru-RU')}
                      </Text>
                      <Tag style={{ fontSize: 11 }}>
                        {isCurrentActor
                          ? 'Вы'
                          : item.changed_by
                          ? `Пользователь ${item.changed_by.slice(0, 8)}...`
                          : 'Система'}
                      </Tag>
                    </div>

                    {item.comment && (
                      <div
                        style={{
                          marginTop: 8,
                          background: item.new_status === 'На доработке' ? '#fff1f0' : '#f5f5f5',
                          borderLeft: `3px solid ${
                            item.new_status === 'На доработке' ? '#ff4d4f' : '#d9d9d9'
                          }`,
                          padding: '6px 12px',
                          borderRadius: '0 6px 6px 0',
                          fontSize: 13,
                        }}
                      >
                        <Text type={item.new_status === 'На доработке' ? 'danger' : undefined}>
                          {item.comment}
                        </Text>
                      </div>
                    )}
                  </div>
                ),
              };
            })}
          />
        )}
      </Card>

      {/* МОДАЛЬНОЕ ОКНО ДЛЯ ОБЯЗАТЕЛЬНОГО КОММЕНТАРИЯ ПРИ ВОЗВРАТЕ НА ДОРАБОТКУ */}
      <Modal
        title="Возврат задачи на доработку"
        open={isReworkModalOpen}
        onCancel={() => {
          setIsReworkModalOpen(false);
          setReworkComment('');
          setReworkError(null);
        }}
        onOk={submitRework}
        okText="Вернуть на доработку"
        okButtonProps={{ danger: true, loading: actionLoading }}
        cancelText="Отмена"
      >
        <Alert
          message="Внимание: по регламенту ТЗ комментарий обязателен"
          description="Укажите исполнителю, что именно необходимо исправить или переделать."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form layout="vertical">
          <Form.Item
            label="Причина возврата / Что доделать"
            required
            validateStatus={reworkError ? 'error' : ''}
            help={reworkError}
          >
            <TextArea
              rows={4}
              value={reworkComment}
              onChange={(e) => {
                setReworkComment(e.target.value);
                if (reworkError) setReworkError(null);
              }}
              placeholder="Например: Не заделаны стыки перекрытий на 2 этаже. Переделать согласно нормам."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

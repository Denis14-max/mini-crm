import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Typography, Select, Empty, Spin, message, Button } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { StatusTag } from '../components/StatusTag';
import type { Task, TaskStatus } from '../types';

const { Title, Text } = Typography;

export const MyTasksPage: React.FC = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<(Task & { objects?: { name: string; address: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const isManager = role === 'manager';

  const loadMyTasks = async () => {
    if (!user) return;
    setLoading(true);

    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          objects:object_id (
            name,
            address
          )
        `)
        .order('created_at', { ascending: false });

      // Если исполнитель — фильтруем по worker_id
      if (!isManager) {
        query = query.eq('worker_id', user.id);
      }

      const { data, error } = await query;

      if (error) {
        message.error('Ошибка загрузки задач: ' + error.message);
      } else {
        setTasks((data as any) || []);
      }
    } catch (e: unknown) {
      if (e instanceof Error) message.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMyTasks();
  }, [user, role]);

  const filteredTasks = tasks.filter((t) => {
    if (selectedStatus === 'all') return true;
    return t.status === selectedStatus;
  });

  const columns = [
    {
      title: 'Задача',
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
      title: 'Объект',
      key: 'object_name',
      render: (_: unknown, record: any) => (
        <span style={{ fontWeight: 500 }}>
          {record.objects?.name || '—'}
        </span>
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
      title: 'Дата назначения',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (dateStr: string) => new Date(dateStr).toLocaleDateString('ru-RU'),
    },
    {
      title: 'Действие',
      key: 'action',
      width: 100,
      render: (_: unknown, record: Task) => (
        <Button
          type="primary"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/tasks/${record.id}`)}
        >
          Открыть
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            {isManager ? 'Все задачи в системе' : 'Мои задачи'}
          </Title>
          <Text type="secondary">
            {isManager
              ? 'Просмотр всех созданных задач компании'
              : 'Задачи, в которых вы назначены исполнителем'}
          </Text>
        </div>

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

      <Card style={{ borderRadius: 12 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : (
          <Table
            dataSource={filteredTasks}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            locale={{
              emptyText: (
                <Empty
                  description={
                    isManager
                      ? 'В системе пока нет задач'
                      : 'У вас пока нет назначенных задач'
                  }
                />
              ),
            }}
          />
        )}
      </Card>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Typography, Modal, Form, Input, Space, Row, Col, Empty, Spin, message, Popconfirm } from 'antd';
import { PlusOutlined, EnvironmentOutlined, ArrowRightOutlined, DeleteOutlined } from '@ant-design/icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { BuildingObject } from '../types';

const { Title, Text, Paragraph } = Typography;

export const ObjectsPage: React.FC = () => {
  const { role } = useAuth();
  const navigate = useNavigate();

  const [objects, setObjects] = useState<BuildingObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form] = Form.useForm();

  const isManager = role === 'manager';

  const loadObjects = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('objects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        message.error('Ошибка загрузки объектов: ' + error.message);
      } else {
        setObjects(data || []);
      }
    } catch (e: unknown) {
      if (e instanceof Error) message.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadObjects();
  }, [role]);

  const handleCreateObject = async (values: { name: string; address: string }) => {
    setCreateLoading(true);
    try {
      const { error } = await supabase.from('objects').insert([
        {
          name: values.name.trim(),
          address: values.address.trim(),
        },
      ]);

      if (error) {
        message.error('Не удалось создать объект: ' + error.message);
      } else {
        message.success('Объект успешно создан');
        setIsModalOpen(false);
        form.resetFields();
        loadObjects();
      }
    } catch (e: unknown) {
      if (e instanceof Error) message.error(e.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteObject = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const { error } = await supabase.from('objects').delete().eq('id', id);
      if (error) {
        message.error('Не удалось удалить объект: ' + error.message);
      } else {
        message.success('Объект удален');
        loadObjects();
      }
    } catch (err: unknown) {
      if (err instanceof Error) message.error(err.message);
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Строительные объекты
          </Title>
          <Text type="secondary">
            {isManager
              ? 'Полный список объектов вашей компании'
              : 'Объекты, на которых у вас есть назначенные задачи'}
          </Text>
        </div>

        {isManager && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            onClick={() => setIsModalOpen(true)}
          >
            Новый объект
          </Button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      ) : objects.length === 0 ? (
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: '40px 0' }}>
          <Empty
            description={
              isManager
                ? 'Объектов пока нет. Добавьте первый строительный объект!'
                : 'У вас пока нет задач ни на одном объекте'
            }
          />
          {isManager && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsModalOpen(true)}
              style={{ marginTop: 16 }}
            >
              Добавить объект
            </Button>
          )}
        </Card>
      ) : (
        <Row gutter={[20, 20]}>
          {objects.map((obj) => (
            <Col xs={24} sm={12} lg={8} key={obj.id}>
              <Card
                hoverable
                style={{
                  borderRadius: 12,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
                onClick={() => navigate(`/objects/${obj.id}`)}
                actions={[
                  <Button
                    type="link"
                    onClick={() => navigate(`/objects/${obj.id}`)}
                    style={{ fontWeight: 500 }}
                  >
                    Перейти к задачам <ArrowRightOutlined />
                  </Button>,
                  ...(isManager
                    ? [
                        <Popconfirm
                          title="Удалить объект?"
                          description="Все привязанные к нему задачи также будут удалены!"
                          okText="Да, удалить"
                          cancelText="Отмена"
                          okButtonProps={{ danger: true }}
                          onConfirm={(e) => handleDeleteObject(obj.id, e)}
                        >
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Удалить
                          </Button>
                        </Popconfirm>,
                      ]
                    : []),
                ]}
              >
                <div>
                  <Title level={4} style={{ marginBottom: 8, color: '#1f1f1f' }}>
                    {obj.name}
                  </Title>
                  <Paragraph
                    type="secondary"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 6,
                      fontSize: 14,
                      marginBottom: 12,
                    }}
                  >
                    <EnvironmentOutlined style={{ color: '#1677ff', marginTop: 4 }} />
                    <span>{obj.address}</span>
                  </Paragraph>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Модальное окно создания объекта (для постановщика) */}
      <Modal
        title="Добавление строительного объекта"
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateObject}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name"
            label="Название объекта"
            rules={[{ required: true, message: 'Укажите название объекта' }]}
          >
            <Input placeholder="Например: ЖК «Северные Высоты», Секция 3" />
          </Form.Item>

          <Form.Item
            name="address"
            label="Адрес стройки"
            rules={[{ required: true, message: 'Укажите адрес объекта' }]}
          >
            <Input placeholder="Например: г. Москва, ул. Ленина, д. 45" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>Отмена</Button>
              <Button type="primary" htmlType="submit" loading={createLoading}>
                Создать объект
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

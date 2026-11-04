import React from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { Layout as AntLayout, Menu, Button, Tag, Space, Typography } from 'antd';
import { ApartmentOutlined, CheckSquareOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';

const { Header, Content } = AntLayout;
const { Text } = Typography;

export const AppLayout: React.FC = () => {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const menuItems = [
    {
      key: '/objects',
      icon: <ApartmentOutlined />,
      label: <Link to="/objects">Объекты</Link>,
    },
    {
      key: '/my-tasks',
      icon: <CheckSquareOutlined />,
      label: <Link to="/my-tasks">Мои задачи</Link>,
    },
  ];

  return (
    <AntLayout style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff',
          padding: '0 24px',
          borderBottom: '1px solid #e8e8e8',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <div
            onClick={() => navigate('/objects')}
            style={{
              fontSize: 18,
              fontWeight: 700,
              cursor: 'pointer',
              color: '#1677ff',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            🏗️ СтройCRM
          </div>
          <Menu
            mode="horizontal"
            selectedKeys={[location.pathname.startsWith('/my-tasks') ? '/my-tasks' : '/objects']}
            items={menuItems}
            style={{ borderBottom: 'none', minWidth: 260 }}
          />
        </div>

        <Space size="middle">
          <Space size="small">
            <UserOutlined style={{ color: '#8c8c8c' }} />
            <Text type="secondary" style={{ fontSize: 13 }}>
              {user?.email}
            </Text>
            {role === 'manager' ? (
              <Tag color="geekblue" style={{ fontWeight: 600 }}>Постановщик</Tag>
            ) : (
              <Tag color="green" style={{ fontWeight: 600 }}>Исполнитель</Tag>
            )}
          </Space>
          <Button
            type="text"
            danger
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            size="small"
          >
            Выйти
          </Button>
        </Space>
      </Header>

      <Content style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <Outlet />
      </Content>
    </AntLayout>
  );
};

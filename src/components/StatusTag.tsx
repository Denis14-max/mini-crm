import React from 'react';
import { Tag } from 'antd';
import type { TaskStatus } from '../types';

interface StatusTagProps {
  status: TaskStatus;
}

export const StatusTag: React.FC<StatusTagProps> = ({ status }) => {
  let color = 'default';

  switch (status) {
    case 'Новая':
      color = 'blue';
      break;
    case 'В работе':
      color = 'processing';
      break;
    case 'На проверке':
      color = 'purple';
      break;
    case 'Принята':
      color = 'success';
      break;
    case 'На доработке':
      color = 'error';
      break;
  }

  return (
    <Tag color={color} style={{ fontWeight: 500, fontSize: 13, padding: '2px 8px' }}>
      {status}
    </Tag>
  );
};

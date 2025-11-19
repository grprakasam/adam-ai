import { message, notification } from 'antd';
import type { ArgsProps } from 'antd/es/notification';
import { translateError } from './errorCatalog';
import { useRecoveryStore } from '../store/recoveryStore';

export const notifyUserError = (error: unknown, context?: string) => {
  const friendly = translateError(error, context);

  useRecoveryStore.getState().addSuggestion({
    title: friendly.title,
    message: friendly.message,
    suggestion: friendly.suggestion,
  });

  message.error(friendly.message);

  const notificationConfig: ArgsProps = {
    message: friendly.title,
    description: friendly.suggestion
      ? `${friendly.message}\nSuggested recovery: ${friendly.suggestion}`
      : friendly.message,
    duration: 4,
  };

  notification.error(notificationConfig);
};

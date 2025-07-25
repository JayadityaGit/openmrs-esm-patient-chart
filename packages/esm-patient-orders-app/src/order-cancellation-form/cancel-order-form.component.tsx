import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, TextArea, ButtonSet, Column, Form, InlineNotification, Stack, InlineLoading } from '@carbon/react';
import { OpenmrsDatePicker, showSnackbar, useLayoutType } from '@openmrs/esm-framework';
import { type DefaultPatientWorkspaceProps, usePatientOrders, type Order } from '@openmrs/esm-patient-common-lib';
import { cancelOrder } from './cancel-order.resource';
import styles from './cancel-order-form.scss';

interface OrderCancellationFormProps extends DefaultPatientWorkspaceProps {
  order: Order;
}

const OrderCancellationForm: React.FC<OrderCancellationFormProps> = ({
  order,
  patientUuid,
  closeWorkspace,
  promptBeforeClosing,
}) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const [showErrorNotification, setShowErrorNotification] = useState(false);
  const { mutate } = usePatientOrders(patientUuid);

  const cancelOrderSchema = useMemo(() => {
    return z.object({
      cancellationDate: z
        .date({
          required_error: t('cancellationDateRequired', 'Cancellation date is required'),
        })
        .refine((date) => date >= dayjs().startOf('day').toDate(), {
          message: t('dateCannotBeBeforeToday', 'Date cannot be before today'),
        }),
      reasonForCancellation: z.string({
        required_error: t('reasonForCancellationRequired', 'Reason for cancellation is required'),
      }),
    });
  }, [t]);

  type CancelOrderFormData = z.infer<typeof cancelOrderSchema>;

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CancelOrderFormData>({
    mode: 'all',
    resolver: zodResolver(cancelOrderSchema),
  });

  function onError(err) {
    if (err?.oneFieldRequired) {
      setShowErrorNotification(true);
    }
  }

  useEffect(() => {
    promptBeforeClosing(() => isDirty);
  }, [isDirty, promptBeforeClosing]);

  const cancelOrderRequest = useCallback(
    (data: CancelOrderFormData) => {
      const formData = data;
      setShowErrorNotification(false);

      const payload = {
        fulfillerStatus: 'DECLINED',
        fulfillerComment: formData.reasonForCancellation,
      };

      cancelOrder(order, payload).then(
        (res) => {
          closeWorkspace();
          mutate();

          showSnackbar({
            title: t('orderCancelled', 'Order cancelled'),
            kind: 'success',
            subtitle: t('successfullyCancelledOrder', 'Order {{orderNumber}} has been cancelled successfully', {
              orderNumber: order?.orderNumber,
            }),
          });
        },
        (err) => {
          showSnackbar({
            isLowContrast: true,
            title: t('errorCancellingOrder', 'Error cancelling order'),
            kind: 'error',
            subtitle: err?.message,
          });
        },
      );
    },
    [closeWorkspace, mutate, order, t],
  );

  return (
    <Form className={styles.form}>
      <div className={styles.grid}>
        <Stack>
          <section>
            <h4 className={styles.orderDisplay}>{order?.display}</h4>
          </section>
          <section>
            <Controller
              name="cancellationDate"
              control={control}
              render={({ field, fieldState }) => (
                <div className={styles.row}>
                  <OpenmrsDatePicker
                    {...field}
                    id="cancellationDate"
                    minDate={dayjs().startOf('day')}
                    labelText={t('cancellationDate', 'Cancellation date')}
                    invalid={Boolean(fieldState?.error?.message)}
                    invalidText={fieldState?.error?.message}
                  />
                </div>
              )}
            />
          </section>
          <section>
            <Controller
              name="reasonForCancellation"
              control={control}
              render={({ field: { onChange, value } }) => (
                <div className={styles.row}>
                  <TextArea
                    type="text"
                    id="reasonForCancellation"
                    labelText={t('reasonForCancellation', 'Reason for cancellation')}
                    value={value}
                    onChange={(evt) => onChange(evt.target.value)}
                    invalid={!!errors['reasonForCancellation']}
                    invalidText={!!errors['reasonForCancellation'] && errors['reasonForCancellation'].message}
                  />
                </div>
              )}
            />
          </section>
        </Stack>
      </div>

      {showErrorNotification && (
        <Column className={styles.errorContainer}>
          <InlineNotification
            lowContrast
            title={t('error', 'Error')}
            subtitle={t('pleaseFillRequiredFields', 'Please fill all the required fields') + '.'}
            onClose={() => setShowErrorNotification(false)}
          />
        </Column>
      )}

      <ButtonSet className={isTablet ? styles.tablet : styles.desktop}>
        <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()}>
          {t('discard', 'Discard')}
        </Button>
        <Button
          className={styles.button}
          kind="primary"
          onClick={handleSubmit(cancelOrderRequest, onError)}
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? (
            <InlineLoading description={t('saving', 'Saving') + '...'} />
          ) : (
            t('saveAndClose', 'Save and close')
          )}
        </Button>
      </ButtonSet>
    </Form>
  );
};

export default OrderCancellationForm;

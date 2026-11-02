import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useLocation, type Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/auth/apiError';
import { useCountdown } from './useCountdown';
import { fieldErrorsFor } from './formErrors';
import { toast } from '@/hooks/use-toast';
import { loginSchema, type LoginFormData } from '@/lib/validation-schemas';
import { Loader2 } from 'lucide-react';

const LOCKOUT_MESSAGE = 'Too many failed login attempts, try again later';
const LOCKOUT_FALLBACK_SECONDS = 60;

const FIELDS: readonly (keyof LoginFormData)[] = ['email', 'password'];

export function Login(): React.ReactElement {
  const { t } = useTranslation('auth');
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { login, user } = useAuth();
  const { secondsLeft, start } = useCountdown();
  const location = useLocation();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const fromLocation = (location.state as { from?: Partial<Location> } | null)
    ?.from;
  const from = fromLocation?.pathname
    ? fromLocation.pathname +
      (fromLocation.search ?? '') +
      (fromLocation.hash ?? '')
    : '/dashboard';

  const showToast = (description: string): void => {
    toast({
      variant: 'destructive',
      title: t('login.failureTitle'),
      description,
    });
  };

  const handleError = (error: unknown): void => {
    if (!(error instanceof ApiError)) {
      showToast(t('errors.generic'));
      return;
    }
    if (error.status === 401) {
      setFormError(t('errors.invalidCredentials'));
      form.resetField('password');
      return;
    }
    if (error.status === 429) {
      if (error.messages[0] === LOCKOUT_MESSAGE) {
        start(error.retryAfterSeconds() ?? LOCKOUT_FALLBACK_SECONDS);
      } else {
        showToast(t('errors.tooManyRequests'));
      }
      return;
    }
    const fields = fieldErrorsFor(error, FIELDS);
    if (error.status === 400 && fields.length > 0) {
      for (const [field, message] of fields) form.setError(field, { message });
      return;
    }
    showToast(t('errors.generic'));
  };

  const onSubmit = async (data: LoginFormData): Promise<void> => {
    setIsLoading(true);
    setFormError(null);
    try {
      await login({ email: data.email, password: data.password });
      toast({
        variant: 'success',
        title: t('login.successTitle'),
        description: t('login.successDescription'),
      });
      // login sets the user; the signed-in redirect below navigates.
    } catch (error) {
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (user) return <Navigate to={from} replace />;

  return (
    <div className="container mx-auto px-4 py-8 md:py-16">
      <div className="mx-auto max-w-md">
        <div className="space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold sm:text-3xl">
              {t('login.title')}
            </h1>
            <p className="text-muted-foreground">{t('login.description')}</p>
          </div>
          <Form
            form={form}
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 rounded-lg border bg-card p-4 sm:p-6"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('login.fields.email')}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder={t('login.fields.emailPlaceholder')}
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('login.fields.password')}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder={t('login.fields.passwordPlaceholder')}
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {formError && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {formError}
              </p>
            )}
            {secondsLeft > 0 && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {t('errors.accountLocked', { seconds: secondsLeft })}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || secondsLeft > 0}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('login.submitting')}
                </>
              ) : (
                t('login.submit')
              )}
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Navigate } from 'react-router-dom';
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
  FormDescription,
} from '@/components/ui/form';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/auth/apiError';
import { toast } from '@/hooks/use-toast';
import {
  registerSchema,
  type RegisterFormData,
} from '@/lib/validation-schemas';
import { Loader2 } from 'lucide-react';
import type { RegisterRequest } from '@/types/auth';
import { fieldErrorsFor } from './formErrors';

const FIELDS: readonly (keyof RegisterFormData)[] = [
  'email',
  'password',
  'first_name',
  'last_name',
  'username',
];

export function Register(): React.ReactElement {
  const { t } = useTranslation('auth');
  const [isLoading, setIsLoading] = useState(false);
  const [userExists, setUserExists] = useState(false);
  const { register: registerUser, user } = useAuth();

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      username: '',
    },
  });

  const showToast = (description: string): void => {
    toast({
      variant: 'destructive',
      title: t('register.failureTitle'),
      description,
    });
  };

  const handleError = (error: unknown): void => {
    if (!(error instanceof ApiError)) {
      showToast(t('errors.generic'));
      return;
    }
    if (error.status === 429) {
      showToast(t('errors.tooManyRequests'));
      return;
    }
    if (
      error.status === 400 &&
      error.messages.includes('User already exists')
    ) {
      setUserExists(true);
      form.setError('email', { message: t('errors.userExists') });
      return;
    }
    const fields = fieldErrorsFor(error, FIELDS);
    if (error.status === 400 && fields.length > 0) {
      for (const [field, message] of fields) form.setError(field, { message });
      return;
    }
    showToast(t('errors.generic'));
  };

  const onSubmit = async (data: RegisterFormData): Promise<void> => {
    setIsLoading(true);
    setUserExists(false);
    try {
      const payload: RegisterRequest = {
        email: data.email,
        password: data.password,
        first_name: data.first_name.trim(),
      };
      if (data.last_name?.trim()) payload.last_name = data.last_name.trim();
      if (data.username?.trim()) payload.username = data.username.trim();

      await registerUser(payload);
      toast({
        variant: 'success',
        title: t('register.successTitle'),
        description: t('register.checkInbox'),
      });
      // register sets the user; the signed-in redirect below navigates.
    } catch (error) {
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Never create a second account from a signed-in tab: its token would be
  // broadcast to tabs still showing the first account.
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="container mx-auto px-4 py-8 md:py-16">
      <div className="mx-auto max-w-md">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold sm:text-3xl">
              {t('register.title')}
            </h1>
            <p className="text-muted-foreground">{t('register.description')}</p>
          </div>
          <Form
            form={form}
            onSubmit={form.handleSubmit(onSubmit)}
            className="rounded-lg border bg-card p-4 sm:p-6 space-y-4"
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
                  {userExists && (
                    <Link
                      to="/login"
                      className="text-sm font-medium text-primary underline"
                    >
                      {t('errors.signInInstead')}
                    </Link>
                  )}
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
                  <FormDescription>
                    {t('register.fields.passwordHint')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="first_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('register.fields.firstName')}{' '}
                    <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder={t('register.fields.firstNamePlaceholder')}
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
              name="last_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('register.fields.lastName')}</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder={t('register.fields.lastNamePlaceholder')}
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
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('register.fields.username')}</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder={t('register.fields.usernamePlaceholder')}
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('register.submitting')}
                </>
              ) : (
                t('register.submit')
              )}
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );
}

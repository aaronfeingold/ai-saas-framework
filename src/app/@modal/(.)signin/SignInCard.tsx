'use client';

import React, { useCallback, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

import { GoogleIcon } from '../CustomIcons';
import ForgotPassword from '../ForgotPassword';
import { signInWithGoogle } from '../OAuth';
import { login } from '../action';

export default function SignInCard() {
  const router = useRouter();
  const [email, setEmail] = useState(
    typeof window !== 'undefined'
      ? (localStorage.getItem('rememberedEmail') ?? '')
      : ''
  );
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(
    typeof window !== 'undefined' && !!localStorage.getItem('rememberedEmail')
  );
  const [emailError, setEmailError] = useState(false);
  const [emailErrorMessage, setEmailErrorMessage] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = useState('');
  const [open, setOpen] = useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const [alertMessage, setAlertMessage] = useState({
    type: '',
    message: '',
  });

  const handleSubmit = async (formData: FormData) => {
    if (validateInputs()) {
      const result = await login(formData);

      setAlertMessage({
        type: result.success ? 'success' : 'error',
        message: result.message,
      });

      if (result.success) {
        if (rememberMe) {
          localStorage.setItem('rememberedEmail', email);
        } else {
          localStorage.removeItem('rememberedEmail');
        }
        router.back();
      }
    }
  };

  const validateInputs = useCallback(() => {
    let isValid = true;
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setEmailError(true);
      setEmailErrorMessage('Please enter a valid email address.');
      isValid = false;
    } else {
      setEmailError(false);
      setEmailErrorMessage('');
    }
    if (!password.trim()) {
      setPasswordError(true);
      setPasswordErrorMessage('Error in password');
      isValid = false;
    } else {
      setPasswordError(false);
      setPasswordErrorMessage('');
    }
    return isValid;
  }, [email, password]);

  return (
    <Card className="flex w-full flex-col gap-4 self-center p-4 shadow-[0px_5px_15px_rgba(0,0,0,0.05),0px_15px_35px_-5px_rgba(25,28,33,0.05),0px_0px_0px_1px_rgba(0,0,0,0.05)] sm:w-[450px] sm:p-6">
      <h1 className="text-[clamp(2rem,10vw,2.15rem)] font-bold">Sign In</h1>

      <form
        action={handleSubmit}
        noValidate
        className="flex w-full flex-col gap-4"
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            name="email"
            placeholder="your@email.com"
            autoComplete="email"
            required
            aria-label="email"
            className={emailError ? 'border-destructive' : ''}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {emailError && (
            <p className="text-destructive text-sm">{emailErrorMessage}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="password">Password</Label>
            <Button
              type="button"
              variant="link"
              onClick={handleClickOpen}
              className="h-auto p-0"
            >
              Forgot your password?
            </Button>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••"
            autoComplete="current-password"
            required
            className={passwordError ? 'border-destructive' : ''}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {passwordError && (
            <p className="text-destructive text-sm">{passwordErrorMessage}</p>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="remember-me"
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(checked === true)}
          />
          <Label
            htmlFor="remember-me"
            className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Remember me
          </Label>
        </div>

        <ForgotPassword open={open} handleClose={handleClose} />

        <SubmitButton />

        {alertMessage.type && (
          <div className="mb-1 w-full">
            <Alert
              variant={
                alertMessage.type === 'error' ? 'destructive' : 'default'
              }
            >
              <AlertDescription>{alertMessage.message}</AlertDescription>
            </Alert>
          </div>
        )}

        <Button asChild variant="outline" className="self-center">
          <Link href="/signup" replace>
            Don&apos;t have an account? Sign up
          </Link>
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background text-muted-foreground px-2">or</span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => signInWithGoogle()}
          className="w-full"
        >
          <GoogleIcon />
          Sign in with Google
        </Button>
      </div>
    </Card>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="mb-1 w-full" disabled={pending}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Sign In'}
    </Button>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Download, LogIn } from "lucide-react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required.")
    .email("Enter a valid email address."),
  password: z
    .string()
    .min(1, "Password is required.")
    .min(8, "Password must be at least 8 characters."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    setIsStandalone(Boolean(standalone));

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setInstallPrompt(null);
      toast.success("CRC Reporting installed.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function onSubmit(values: LoginFormValues) {
    setAuthError(null);
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: values.email.toLowerCase(),
        password: values.password,
        redirect: false,
      });

      if (!result || result.error || !result.ok) {
        const message = "Invalid email or password. Please check your details and try again.";
        setAuthError(message);
        toast.error(message);
        return;
      }

      toast.success("Welcome back");
      router.push(callbackUrl);
      router.refresh();
    } catch {
      const message = "Sign-in failed. Please try again.";
      setAuthError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleInstallClick() {
    if (isStandalone) {
      toast.success("CRC Reporting is already installed on this device.");
      return;
    }

    if (!installPrompt) {
      toast.error("Install prompt not available yet. Use Chrome or Edge and refresh this page.");
      return;
    }

    setInstalling(true);
    try {
      await installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === "accepted") {
        toast.success("Installation started.");
      } else {
        toast.error("Installation was dismissed.");
      }
      setInstallPrompt(null);
    } finally {
      setInstalling(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium text-slate-700">
          Email
        </label>
        <Input id="email" placeholder="pastor@church.com" autoComplete="email" {...register("email")} />
        {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          Password
        </label>
        <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
        {errors.password ? <p className="text-xs text-red-600">{errors.password.message}</p> : null}
      </div>
      <Button type="submit" fullWidth disabled={loading}>
        <LogIn className="mr-2 h-4 w-4" />
        {loading ? "Signing in..." : "Sign in"}
      </Button>
      {authError ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
          aria-live="polite"
        >
          {authError}
        </p>
      ) : null}
      <div className="flex justify-center pt-1">
        <Image
          src="/icons/icon-192.png"
          alt="CRC Reporting install logo"
          width={56}
          height={56}
          className="h-14 w-14 rounded-xl border border-slate-200 bg-slate-50 p-1"
        />
      </div>
      <Button type="button" variant="outline" fullWidth disabled={installing} onClick={handleInstallClick}>
        <Download className="mr-2 h-4 w-4" />
        {installing
          ? "Opening install..."
          : isStandalone
            ? "Installed"
            : installPrompt
              ? "Install CRC Reporting"
              : "Install CRC Reporting"}
      </Button>
      {!isStandalone && !installPrompt ? (
        <p className="text-xs text-slate-500">If install does not appear, open in Chrome/Edge over HTTPS.</p>
      ) : null}
    </form>
  );
}


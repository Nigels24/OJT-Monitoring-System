"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLoginMutation } from "@/lib/api/authApi";
import {
  persistSession,
  ROLE_HOME,
  ROLE_PREFIX,
  type StoredUser,
} from "@/lib/auth";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import TextField from "@/components/ui/TextField";
import Tabs, { TabOption } from "@/components/ui/Tabs";
import {
  Lock,
  User,
  KeyRound,
  UserRound,
  Briefcase,
  IdCard,
  HelpCircle,
  LogIn,
} from "lucide-react";

type Role = "Student" | "Supervisor" | "Coordinator";

const ROLE_OPTIONS: TabOption<Role>[] = [
  { key: "Student", label: "Student", icon: UserRound },
  { key: "Supervisor", label: "Supervisor", icon: Briefcase },
  { key: "Coordinator", label: "Coordinator", icon: IdCard },
];

export default function LoginPage() {
  const router = useRouter();
  const [login, { isLoading }] = useLoginMutation();

  // Cosmetic only — not sent to the backend. The server determines the
  // actual role from the account record and returns it in the response.
  const [selectedRole, setSelectedRole] = useState<Role>("Student");
  // Username or email — the coordinator issues usernames, but accounts made
  // before usernames existed still sign in with their email.
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showForgotHelp, setShowForgotHelp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const result = await login({ identifier, password }).unwrap();
      const user = result.user as StoredUser;

      if (!ROLE_HOME[user.role]) {
        setError("Unknown role returned from server.");
        return;
      }

      persistSession(result.accessToken, user);

      // `proxy.ts` adds ?next=... when it bounces an unauthenticated visitor
      // off a protected page. Honour it, but only within this role's own
      // section so the parameter can't be used to land somewhere they'd
      // immediately be redirected away from.
      //
      // Read from window rather than useSearchParams() — the latter opts the
      // whole page out of prerendering unless it sits inside a Suspense
      // boundary, and this value is only needed here at submit time.
      const next = new URLSearchParams(window.location.search).get("next");
      const destination =
        next && next.startsWith(ROLE_PREFIX[user.role])
          ? next
          : ROLE_HOME[user.role];

      router.push(destination);
    } catch (err: any) {
      setError(err?.data?.message || "Invalid username or password.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-blue-600">
          OJT Monitoring System
        </h1>
        <p className="text-center text-gray-500 text-sm mt-1 mb-6">
          West Prime Horizon Institute Inc.
        </p>

        <Tabs
          options={ROLE_OPTIONS}
          value={selectedRole}
          onChange={setSelectedRole}
        />

        <form onSubmit={handleSubmit} className="mt-6">
          <TextField
            label="Username"
            labelIcon={User}
            fieldIcon={User}
            type="text"
            required
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Enter your username or email"
            className="mb-4"
          />

          <TextField
            label="Password"
            labelIcon={Lock}
            fieldIcon={KeyRound}
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="mb-2"
          />

          <div className="text-right mb-5">
            <button
              type="button"
              onClick={() => {
                setShowForgotHelp(true);
              }}
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              <HelpCircle size={14} />
              Forgot Password?
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-600 mb-4 text-center">{error}</p>
          )}

          <Button type="submit" icon={LogIn} loading={isLoading}>
            Login to OJT Monitoring System
          </Button>
        </form>
      </Card>

      {/* There is no emailed reset link — no mail infrastructure exists, and
          the coordinator already issues every credential by hand. So this
          explains the actual recovery route rather than pretending to send
          an email. */}
      {showForgotHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-md">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound size={20} className="text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Forgot your password?
              </h2>
            </div>

            <div className="space-y-4 text-sm text-gray-600">
              <div>
                <p className="font-medium text-gray-900 mb-1">
                  Students and supervisors
                </p>
                <p>
                  Ask your OJT coordinator. They can issue you a new password
                  straight away, and you can change it yourself once you sign
                  in.
                </p>
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-1">Coordinators</p>
                <p>
                  Run{" "}
                  <code className="px-1.5 py-0.5 rounded bg-gray-100 font-mono text-xs">
                    npm run reset-coordinator
                  </code>{" "}
                  in <span className="font-mono text-xs">app/server</span>. It
                  prints a new password you can sign in with.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <Button
                type="button"
                onClick={() => {
                  setShowForgotHelp(false);
                }}
              >
                Got it
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

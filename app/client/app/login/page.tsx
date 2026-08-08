"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLoginMutation } from "@/lib/api/authApi";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import TextField from "@/components/ui/TextField";
import Tabs, { TabOption } from "@/components/ui/Tabs";
import {
  Mail,
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const result = await login({ email, password }).unwrap();
      localStorage.setItem("token", result.accessToken);
      localStorage.setItem("user", JSON.stringify(result.user));

      switch (result.user.role) {
        case "STUDENT":
          router.push("/student/dashboard");
          break;
        case "SUPERVISOR":
          router.push("/supervisor/attendance");
          break;
        case "COORDINATOR":
          router.push("/coordinator/dashboard");
          break;
        default:
          setError("Unknown role returned from server.");
      }
    } catch (err: any) {
      setError(err?.data?.message || "Invalid email or password.");
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
            label="Email"
            labelIcon={Mail}
            fieldIcon={User}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
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
            <a
              href=""
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              <HelpCircle size={14} />
              Forgot Password?
            </a>
          </div>

          {error && (
            <p className="text-sm text-red-600 mb-4 text-center">{error}</p>
          )}

          <Button type="submit" icon={LogIn} loading={isLoading}>
            Login to OJT Monitoring System
          </Button>
        </form>
      </Card>
    </div>
  );
}

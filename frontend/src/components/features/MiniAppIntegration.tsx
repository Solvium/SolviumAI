import React, { useState } from "react";
import { useMiniAppApi } from "@/hooks/useMiniAppApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

interface MiniAppIntegrationProps {
  onSuccess?: (response: any) => void;
}

export const MiniAppIntegration: React.FC<MiniAppIntegrationProps> = ({
  onSuccess,
}) => {
  const { getOrCreateUser, isLoading, error, clearError } = useMiniAppApi();
  const [formData, setFormData] = useState({
    telegram_user_id: "",
    username: "",
    first_name: "",
  });
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setResult(null);

    const response = await getOrCreateUser({
      telegram_user_id: parseInt(formData.telegram_user_id),
      username: formData.username,
      first_name: formData.first_name,
    });

    if (response) {
      setResult(response);
      onSuccess?.(response);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Mini App API Integration</CardTitle>
        <CardDescription>
          Test the mini app wallet/get-or-create endpoint
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="telegram_user_id"
              className="block text-sm font-medium mb-1"
            >
              Telegram User ID
            </label>
            <Input
              id="telegram_user_id"
              type="number"
              value={formData.telegram_user_id}
              onChange={(e) =>
                handleInputChange("telegram_user_id", e.target.value)
              }
              placeholder="1447332396"
              required
            />
          </div>

          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium mb-1"
            >
              Username
            </label>
            <Input
              id="username"
              type="text"
              value={formData.username}
              onChange={(e) => handleInputChange("username", e.target.value)}
              placeholder="bolajumuch"
              required
            />
          </div>

          <div>
            <label
              htmlFor="first_name"
              className="block text-sm font-medium mb-1"
            >
              First Name
            </label>
            <Input
              id="first_name"
              type="text"
              value={formData.first_name}
              onChange={(e) => handleInputChange("first_name", e.target.value)}
              placeholder="bolajumuch"
              required
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing API...
              </>
            ) : (
              "Test Mini App API"
            )}
          </Button>
        </form>

        {result && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">API Response:</h3>
            <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-auto max-h-60">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

const EXAMPLES = [
  {
    level: "Critical",
    color: "text-rose-500",
    examples: [
      "Reading or modifying any other user's private data or account without permission.",
      "Bypassing payment checkout to get paid items for free.",
      "Admin panel accessible to normal users.",
    ],
  },
  {
    level: "High",
    color: "text-amber-500",
    examples: [
      "Stored XSS affecting other users.",
      "Password reset token leak or account takeover.",
      "Discount code or wallet balance manipulation.",
    ],
  },
  {
    level: "Medium",
    color: "text-blue-500",
    examples: [
      "Reflected XSS requiring user interaction.",
      "Missing authorization check on a non-sensitive action.",
      "CSRF on profile settings.",
    ],
  },
  {
    level: "Low",
    color: "text-muted-foreground",
    examples: [
      "Minor information disclosure with no direct exploit path.",
      "Missing rate limit on a non-critical form.",
    ],
  },
];

export default function SeverityGuidePage() {
  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/dashboard/experts" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Experts
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Severity Guide</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {EXAMPLES.map((item) => (
          <Card key={item.level}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-sm font-semibold ${item.color}`}>{item.level}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground">
                {item.examples.map((ex, i) => <li key={i}>{ex}</li>)}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

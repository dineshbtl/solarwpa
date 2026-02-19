"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  HelpCircle,
  MessageCircle,
  Mail,
  Phone,
  FileText,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Users,
  Zap,
  ClipboardCheck,
  Wrench,
  CheckCircle,
} from "lucide-react"

interface FAQItem {
  question: string
  answer: string
}

const faqItems: FAQItem[] = [
  {
    question: "How do I create a new survey?",
    answer:
      "Navigate to the Surveys page and click the 'New Survey' button. Fill in the required beneficiary information including name, service number, and Aadhar details. Complete all site details and submit for approval.",
  },
  {
    question: "What is the workflow for installations?",
    answer:
      "The installation workflow follows: Survey → Approval → Installation → Inspection. Once a survey is approved, an installation can be created. After installation is complete, it goes for inspection before final approval.",
  },
  {
    question: "How do I assign tasks to team members?",
    answer:
      "As an admin or manager, you can assign roles to users from the Users section. Role-based access controls determine what each team member can view and edit in the system.",
  },
  {
    question: "What roles are available in the system?",
    answer:
      "The system supports five roles: Admin (full access), Manager (manage projects and users), Engineer (handle installations), Surveyor (create surveys), and Government (view and approve inspections).",
  },
  {
    question: "How do I track installation progress?",
    answer:
      "Go to the Installations page to see all installations. Each installation shows its current status: pending, in progress, or completed. Click on any installation for detailed progress information.",
  },
  {
    question: "What happens after a survey is submitted?",
    answer:
      "After submission, surveys go through an approval workflow. Managers can approve or reject surveys. Once approved, the survey becomes eligible for installation creation.",
  },
  {
    question: "How do I upload site photos and documents?",
    answer:
      "During survey or installation creation, you can upload photos and documents using the upload feature. Supported formats include images (JPG, PNG) and documents (PDF).",
  },
  {
    question: "Who can approve inspections?",
    answer:
      "Inspections require approval from both a manager and a government inspector. Both approvals must be completed before an installation is considered fully approved.",
  },
]

const contactInfo = [
  {
    icon: Mail,
    title: "Email Support",
    description: "Send us an email for any queries",
    value: "support@skyvolts.com",
    action: "mailto:support@skyvolts.com",
    actionLabel: "Send Email",
  },
  {
    icon: Phone,
    title: "Phone Support",
    description: "Available during business hours",
    value: "+91 98765 43210",
    action: "tel:+919876543210",
    actionLabel: "Call Now",
  },
  {
    icon: MessageCircle,
    title: "Live Chat",
    description: "Chat with our support team",
    value: "Available 9 AM - 6 PM",
    action: "#",
    actionLabel: "Start Chat",
  },
]

const documentationLinks = [
  {
    icon: BookOpen,
    title: "User Guide",
    description: "Complete guide to using SolarEPC",
    href: "#",
  },
  {
    icon: FileText,
    title: "API Documentation",
    description: "Technical documentation for developers",
    href: "#",
  },
  {
    icon: Users,
    title: "Role Permissions",
    description: "Understand user roles and access",
    href: "#",
  },
]

export default function HelpPage() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index)
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gradient-green">Help & Support</h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">
            Find answers to common questions and get support
          </p>
        </div>

        <div className="space-y-8">
          {/* Quick Links Section */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-gradient-dark-green p-2">
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Surveys</p>
                    <p className="text-xs text-muted-foreground">Create & manage</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-gradient-dark-green p-2">
                    <Wrench className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Installations</p>
                    <p className="text-xs text-muted-foreground">Track progress</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-gradient-dark-green p-2">
                    <ClipboardCheck className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Inspections</p>
                    <p className="text-xs text-muted-foreground">Review & approve</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-gradient-dark-green p-2">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Projects</p>
                    <p className="text-xs text-muted-foreground">Organize work</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* FAQ Section */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                Frequently Asked Questions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {faqItems.map((item, index) => (
                  <div
                    key={index}
                    className="border border-border rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => toggleFaq(index)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
                    >
                      <span className="font-medium text-foreground pr-4">{item.question}</span>
                      {openFaqIndex === index ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      )}
                    </button>
                    {openFaqIndex === index && (
                      <div className="px-4 pb-4">
                        <p className="text-muted-foreground">{item.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Contact Support Section */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                Contact Support
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                {contactInfo.map((contact, index) => {
                  const Icon = contact.icon
                  return (
                    <div
                      key={index}
                      className="p-4 rounded-lg bg-muted/30 flex flex-col items-center text-center"
                    >
                      <div className="rounded-full bg-gradient-dark-green p-3 mb-3">
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <p className="font-medium text-foreground">{contact.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{contact.description}</p>
                      <p className="text-sm font-medium text-foreground mt-2">{contact.value}</p>
                      <Button variant="outline" size="sm" className="mt-3" asChild>
                        <a href={contact.action}>{contact.actionLabel}</a>
                      </Button>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Documentation Section */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Documentation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                {documentationLinks.map((link, index) => {
                  const Icon = link.icon
                  return (
                    <a
                      key={index}
                      href={link.href}
                      className="p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <Icon className="h-5 w-5 text-primary" />
                        <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="font-medium text-foreground mt-3">{link.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{link.description}</p>
                    </a>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* System Info Card */}
          <Card className="border-border bg-muted/30 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                About SolarEPC
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-lg bg-background/50">
                  <p className="text-sm text-muted-foreground">Version</p>
                  <p className="font-medium text-foreground">1.0.0</p>
                </div>
                {/* <div className="p-4 rounded-lg bg-background/50">
                  <p className="text-sm text-muted-foreground">Build</p>
                  <p className="font-medium text-foreground">Production</p>
                </div> */}
                {/* <div className="p-4 rounded-lg bg-background/50">
                  <p className="text-sm text-muted-foreground">Platform</p>
                  <p className="font-medium text-foreground">Next.js + Supabase</p>
                </div> */}
                <div className="p-4 rounded-lg bg-background/50">
                  <p className="text-sm text-muted-foreground">License</p>
                  <p className="font-medium text-foreground">Enterprise</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

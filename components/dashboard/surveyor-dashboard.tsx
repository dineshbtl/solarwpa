"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MapPin, Wrench, Clock, CheckCircle } from "lucide-react"
import { AppNav } from "@/components/navigation/app-nav"

export function SurveyorDashboard() {
  const stats = [
    { label: "Pending Surveys", value: "8", icon: MapPin, color: "text-orange-600" },
    { label: "Active Installations", value: "3", icon: Wrench, color: "text-blue-600" },
    { label: "Awaiting Approval", value: "5", icon: Clock, color: "text-yellow-600" },
    { label: "Completed", value: "42", icon: CheckCircle, color: "text-green-600" },
  ]

  const pendingTasks = [
    {
      id: 1,
      type: "Survey",
      customer: "Rajesh Kumar",
      address: "123 MG Road, Bangalore",
      date: "2024-01-15",
      priority: "high",
    },
    {
      id: 2,
      type: "Installation",
      customer: "Priya Sharma",
      address: "45 Park Street, Delhi",
      date: "2024-01-16",
      priority: "medium",
    },
    {
      id: 3,
      type: "Survey",
      customer: "Amit Patel",
      address: "78 Lake View, Mumbai",
      date: "2024-01-17",
      priority: "low",
    },
  ]

  return (
    <div className="flex">
      <AppNav userRole="surveyor" />
      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Welcome back, Engineer</h1>
          <p className="text-neutral-600">Here's what's on your schedule today</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.label} className="bg-white border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-neutral-600 mb-1">{stat.label}</p>
                      <p className="text-3xl font-bold text-neutral-900">{stat.value}</p>
                    </div>
                    <div className={cn("p-3 rounded-full bg-neutral-100", stat.color)}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Quick Actions */}
        <Card className="bg-white border-border mb-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/surveys/new">
                <Button className="w-full bg-[#e8b44f] hover:bg-[#d9a43f] text-[#2d2d2d]">
                  <MapPin className="w-5 h-5 mr-2" />
                  New Site Survey
                </Button>
              </Link>
              <Link href="/installations/new">
                <Button className="w-full bg-[#2d2d2d] hover:bg-[#3d3d3d]">
                  <Wrench className="w-5 h-5 mr-2" />
                  Start Installation
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Pending Tasks */}
        <Card className="bg-white border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Today's Tasks</CardTitle>
              <span className="text-sm text-neutral-600">{pendingTasks.length} pending</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-neutral-300 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={cn(
                          "px-2 py-1 text-xs font-medium rounded",
                          task.type === "Survey" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700",
                        )}
                      >
                        {task.type}
                      </span>
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          task.priority === "high"
                            ? "bg-red-500"
                            : task.priority === "medium"
                              ? "bg-yellow-500"
                              : "bg-green-500",
                        )}
                      />
                    </div>
                    <h4 className="font-semibold text-neutral-900 mb-1">{task.customer}</h4>
                    <p className="text-sm text-neutral-600">{task.address}</p>
                    <p className="text-xs text-neutral-500 mt-1">Scheduled: {task.date}</p>
                  </div>
                  <Button variant="outline" size="sm" className="border-neutral-300 bg-transparent">
                    View Details
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AppNav } from "@/components/navigation/app-nav"
import { ClipboardList, Package, CheckCircle, AlertCircle, TrendingUp } from "lucide-react"
import Link from "next/link"

export function ManagerDashboard() {
  const stats = [
    { label: "Pending Approvals", value: "12", icon: ClipboardList, color: "text-orange-600" },
    { label: "Material Dispatched", value: "8", icon: Package, color: "text-blue-600" },
    { label: "Final Inspections", value: "6", icon: CheckCircle, color: "text-green-600" },
    { label: "Issues", value: "2", icon: AlertCircle, color: "text-red-600" },
  ]

  const approvalQueue = [
    {
      id: 1,
      type: "Site Survey",
      customer: "Rajesh Kumar",
      surveyor: "Amit Singh",
      submittedDate: "2024-01-14",
      area: "850 sq ft",
      feasibility: "Feasible",
    },
    {
      id: 2,
      type: "Installation",
      customer: "Priya Sharma",
      surveyor: "Vijay Kumar",
      submittedDate: "2024-01-13",
      capacity: "5 kW",
      status: "Review",
    },
  ]

  return (
    <div className="flex">
      <AppNav userRole="manager" />
      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Manager Dashboard</h1>
          <p className="text-neutral-600">Oversee all solar installation projects</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.label} className="bg-white border-neutral-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-neutral-600 mb-1">{stat.label}</p>
                      <p className="text-3xl font-bold text-neutral-900">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-full bg-neutral-100 ${stat.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Approval Queue */}
        <Card className="bg-white border-neutral-200 mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Approval Queue</CardTitle>
              <Link href="/approvals">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {approvalQueue.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-neutral-200"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-700">
                        {item.type}
                      </span>
                      <span className="text-xs text-neutral-500">Submitted {item.submittedDate}</span>
                    </div>
                    <h4 className="font-semibold text-neutral-900 mb-1">{item.customer}</h4>
                    <p className="text-sm text-neutral-600">Surveyor: {item.surveyor}</p>
                    <div className="flex gap-4 mt-2 text-xs text-neutral-600">
                      {item.area && <span>Area: {item.area}</span>}
                      {item.capacity && <span>Capacity: {item.capacity}</span>}
                      {item.feasibility && <span className="text-green-600 font-medium">{item.feasibility}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="border-neutral-300 bg-transparent">
                      View
                    </Button>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-white border-neutral-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                This Month's Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-neutral-600">Surveys Completed</span>
                    <span className="font-semibold">24/30</span>
                  </div>
                  <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                    <div className="h-full bg-[#e8b44f] w-[80%]" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-neutral-600">Installations</span>
                    <span className="font-semibold">18/25</span>
                  </div>
                  <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 w-[72%]" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-neutral-600">Final Approvals</span>
                    <span className="font-semibold">15/18</span>
                  </div>
                  <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                    <div className="h-full bg-green-600 w-[83%]" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-neutral-200">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-900">Survey Approved</p>
                    <p className="text-xs text-neutral-600">Rajesh Kumar - 2 hours ago</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-900">Material Dispatched</p>
                    <p className="text-xs text-neutral-600">Priya Sharma - 4 hours ago</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-900">Inspection Pending</p>
                    <p className="text-xs text-neutral-600">Amit Patel - 1 day ago</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

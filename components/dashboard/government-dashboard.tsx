"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AppNav } from "@/components/navigation/app-nav"
import { CheckCircle, Clock, FileText, MapPin } from "lucide-react"
import Link from "next/link"

export function GovernmentDashboard() {
  const stats = [
    { label: "Pending Inspections", value: "6", icon: Clock, color: "text-yellow-600" },
    { label: "Inspected Today", value: "3", icon: CheckCircle, color: "text-green-600" },
    { label: "Total Approved", value: "158", icon: FileText, color: "text-blue-600" },
    { label: "Locations", value: "12", icon: MapPin, color: "text-purple-600" },
  ]

  const inspectionQueue = [
    {
      id: 1,
      customer: "Rajesh Kumar",
      address: "123 MG Road, Bangalore",
      capacity: "5 kW",
      installedDate: "2024-01-10",
      manager: "Suresh Reddy",
    },
    {
      id: 2,
      customer: "Priya Sharma",
      address: "45 Park Street, Delhi",
      capacity: "7 kW",
      installedDate: "2024-01-08",
      manager: "Suresh Reddy",
    },
  ]

  return (
    <div className="flex">
      <AppNav userRole="government" />
      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Government Inspector Dashboard</h1>
          <p className="text-neutral-600">Review and approve solar installations</p>
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
                    <div className={`p-3 rounded-full bg-neutral-100 ${stat.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Inspection Queue */}
        <Card className="bg-white border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pending Inspections</CardTitle>
              <Link href="/inspections">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {inspectionQueue.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border"
                >
                  <div className="flex-1">
                    <h4 className="font-semibold text-neutral-900 mb-1">{item.customer}</h4>
                    <p className="text-sm text-neutral-600 mb-2">{item.address}</p>
                    <div className="flex gap-4 text-xs text-neutral-600">
                      <span>Capacity: {item.capacity}</span>
                      <span>Installed: {item.installedDate}</span>
                      <span>Manager: {item.manager}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/inspections/${item.id}`}>
                      <Button variant="outline" size="sm" className="border-neutral-300 bg-transparent">
                        View Details
                      </Button>
                    </Link>
                    <Link href={`/inspections/${item.id}/inspect`}>
                      <Button size="sm" className="bg-[#e8b44f] hover:bg-[#d9a43f] text-[#2d2d2d]">
                        Start Inspection
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

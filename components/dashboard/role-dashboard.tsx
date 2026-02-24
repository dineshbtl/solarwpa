"use client"

import { useState } from "react"
import { SurveyorDashboard } from "./surveyor-dashboard"
import { ManagerDashboard } from "./manager-dashboard"
import { GovernmentDashboard } from "./government-dashboard"
import { Button } from "@/components/ui/button"

type Role = "surveyor" | "manager" | "government"

export function RoleDashboard() {
  // In a real app, this would come from auth context
  const [currentRole, setCurrentRole] = useState<Role>("surveyor")

  return (
    <div className="min-h-screen bg-[#f5f3ef]">
      {/* Role Selector - for demo purposes */}
      <div className="bg-white border-b border-border px-6 py-3">
        <div className="flex gap-2">
          <Button
            onClick={() => setCurrentRole("surveyor")}
            variant={currentRole === "surveyor" ? "default" : "outline"}
            size="sm"
          >
            Surveyor View
          </Button>
          <Button
            onClick={() => setCurrentRole("manager")}
            variant={currentRole === "manager" ? "default" : "outline"}
            size="sm"
          >
            Manager View
          </Button>
          <Button
            onClick={() => setCurrentRole("government")}
            variant={currentRole === "government" ? "default" : "outline"}
            size="sm"
          >
            Government View
          </Button>
        </div>
      </div>

      {currentRole === "surveyor" && <SurveyorDashboard />}
      {currentRole === "manager" && <ManagerDashboard />}
      {currentRole === "government" && <GovernmentDashboard />}
    </div>
  )
}

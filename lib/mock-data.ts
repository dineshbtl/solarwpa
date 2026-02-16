export type SurveyStatus = "pending" | "approved" | "rejected"
export type InstallationStatus = "pending" | "in_progress" | "completed" | "inspection_pending"
export type InspectionStatus = "pending" | "approved" | "rejected" | "reopened"

export interface Survey {
  id: string
  projectId: string
  customerName: string
  address: string
  area: number
  feasibility: "feasible" | "not_feasible"
  gpsLocation: { lat: number; lng: number }
  images: string[]
  notes: string
  status: SurveyStatus
  engineerId: string
  engineerName: string
  createdAt: string
  approvedBy?: string
  approvedAt?: string
}

export interface Installation {
  id: string
  surveyId: string
  projectId: string
  customerName: string
  address: string
  materials: Material[]
  installationImages: InstallationImage[]
  status: InstallationStatus
  engineerId: string
  engineerName: string
  startedAt: string
  completedAt?: string
}

export interface Material {
  id: string
  name: string
  serialNumber: string
  barcode: string
  scannedAt: string
}

export interface InstallationImage {
  id: string
  url: string
  category: "panel_placement" | "wiring" | "inverter" | "meter" | "overall"
  description: string
  uploadedAt: string
}

export interface Inspection {
  id: string
  installationId: string
  projectId: string
  customerName: string
  address: string
  status: InspectionStatus
  managerApproval: {
    approved: boolean
    remarks: string
    approvedAt?: string
    approvedBy?: string
  }
  governmentInspection?: {
    approved: boolean
    remarks: string
    inspectedAt?: string
    inspectorName?: string
  }
  createdAt: string
}

// Mock data
export const mockSurveys: Survey[] = [
  {
    id: "SUR-001",
    projectId: "PROJ-001",
    customerName: "Rajesh Kumar",
    address: "123 MG Road, Bangalore, Karnataka 560001",
    area: 1200,
    feasibility: "feasible",
    gpsLocation: { lat: 12.9716, lng: 77.5946 },
    images: ["/rooftop-aerial-view.jpg", "/roof-measurement.jpg"],
    notes: "South-facing roof with no obstructions. Excellent sun exposure throughout the day.",
    status: "approved",
    engineerId: "ENG-001",
    engineerName: "Amit Sharma",
    createdAt: "2024-01-15T10:30:00Z",
    approvedBy: "Priya Singh",
    approvedAt: "2024-01-16T14:20:00Z",
  },
  {
    id: "SUR-002",
    projectId: "PROJ-002",
    customerName: "Sunita Patel",
    address: "45 Park Street, Mumbai, Maharashtra 400001",
    area: 800,
    feasibility: "feasible",
    gpsLocation: { lat: 19.076, lng: 72.8777 },
    images: ["/residential-rooftop.jpg"],
    notes: "Moderate sun exposure. Minor shading from nearby trees in the morning.",
    status: "pending",
    engineerId: "ENG-002",
    engineerName: "Vikram Reddy",
    createdAt: "2024-01-18T09:15:00Z",
  },
]

export const mockInstallations: Installation[] = [
  {
    id: "INST-001",
    surveyId: "SUR-001",
    projectId: "PROJ-001",
    customerName: "Rajesh Kumar",
    address: "123 MG Road, Bangalore, Karnataka 560001",
    materials: [
      {
        id: "MAT-001",
        name: "Solar Panel 450W",
        serialNumber: "SP45W-2024-001234",
        barcode: "7891234567890",
        scannedAt: "2024-01-20T08:30:00Z",
      },
      {
        id: "MAT-002",
        name: "Solar Panel 450W",
        serialNumber: "SP45W-2024-001235",
        barcode: "7891234567891",
        scannedAt: "2024-01-20T08:32:00Z",
      },
      {
        id: "MAT-003",
        name: "Inverter 5kW",
        serialNumber: "INV5K-2024-000567",
        barcode: "7891234567892",
        scannedAt: "2024-01-20T10:15:00Z",
      },
    ],
    installationImages: [
      {
        id: "IMG-001",
        url: "/solar-panels-on-roof.png",
        category: "panel_placement",
        description: "8 panels installed on south-facing section",
        uploadedAt: "2024-01-20T11:30:00Z",
      },
      {
        id: "IMG-002",
        url: "/electrical-wiring-solar.jpg",
        category: "wiring",
        description: "DC wiring from panels to inverter",
        uploadedAt: "2024-01-20T13:45:00Z",
      },
      {
        id: "IMG-003",
        url: "/solar-inverter-installation.png",
        category: "inverter",
        description: "5kW inverter mounted in utility room",
        uploadedAt: "2024-01-20T14:20:00Z",
      },
    ],
    status: "completed",
    engineerId: "ENG-003",
    engineerName: "Rahul Verma",
    startedAt: "2024-01-20T08:00:00Z",
    completedAt: "2024-01-20T16:00:00Z",
  },
]

export const mockInspections: Inspection[] = [
  {
    id: "INSP-001",
    installationId: "INST-001",
    projectId: "PROJ-001",
    customerName: "Rajesh Kumar",
    address: "123 MG Road, Bangalore, Karnataka 560001",
    status: "pending",
    managerApproval: {
      approved: true,
      remarks: "Installation looks good. All materials verified.",
      approvedAt: "2024-01-21T10:00:00Z",
      approvedBy: "Priya Singh",
    },
    createdAt: "2024-01-20T16:30:00Z",
  },
]

export const mockDashboardStats = {
  totalProjects: 203,
  pendingSurveys: 12,
  activeInstallations: 8,
  completedThisMonth: 24,
}

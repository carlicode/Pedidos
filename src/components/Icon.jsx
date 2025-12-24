import React from 'react'
import {
  User,
  Package,
  Truck,
  Bike,
  CreditCard,
  Calculator,
  Clock,
  CheckCircle,
  XCircle,
  Edit,
  RefreshCw,
  LogOut,
  FileText,
  BarChart3,
  Sun,
  Moon,
  Eye,
  Download,
  Plus,
  Save,
  Trash2,
  Car,
  Upload,
  Calendar,
  Undo,
  Users,
  AlertTriangle,
  Layers,
  Search,
  Filter,
  Building,
  Image,
  Activity,
  Tag,
  ArrowLeft,
  ExternalLink,
  MapPin,
  Smartphone,
  ListChecks,
  FolderPlus,
  Wallet,
  PlusCircle,
  Lock,
  Info
} from 'lucide-react'

const iconMap = {
  // Iconos realmente utilizados en la aplicación
  user: User,
  package: Package,
  truck: Truck,
  bike: Bike,
  creditCard: CreditCard,
  calculator: Calculator,
  clock: Clock,
  'check-circle': CheckCircle,
  checkCircle: CheckCircle,
  xCircle: XCircle,
  edit: Edit,
  refresh: RefreshCw,
  refreshCw: RefreshCw,
  'refresh-cw': RefreshCw,
  logOut: LogOut,
  fileText: FileText,
  barChart3: BarChart3,
  barChart: BarChart3, // Alias para módulo de horarios
  sun: Sun,
  moon: Moon,
  eye: Eye,
  // Iconos para módulo de horarios
  download: Download,
  plus: Plus,
  save: Save,
  trash2: Trash2,
  car: Car,
  upload: Upload,
  calendar: Calendar,
  undo: Undo,
  users: Users,
  // Iconos adicionales
  'alert-triangle': AlertTriangle,
  alertTriangle: AlertTriangle,
  layers: Layers,
  search: Search,
  filter: Filter,
  building: Building,
  image: Image,
  activity: Activity,
  tag: Tag,
  'arrow-left': ArrowLeft,
  arrowLeft: ArrowLeft,
  'external-link': ExternalLink,
  externalLink: ExternalLink,
  'map-pin': MapPin,
  mapPin: MapPin,
  smartphone: Smartphone,
  listChecks: ListChecks,
  'list-checks': ListChecks,
  folderPlus: FolderPlus,
  'folder-plus': FolderPlus,
  wallet: Wallet,
  'plus-circle': PlusCircle,
  plusCircle: PlusCircle,
  lock: Lock,
  info: Info
}

const Icon = ({ name, size = 20, color, className = '', ...props }) => {
  const IconComponent = iconMap[name]
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found`)
    return null
  }
  
  return (
    <IconComponent 
      size={size} 
      color={color}
      className={className}
      {...props}
    />
  )
}

export default Icon
interface Route {
  destination: string
  price: string
}

interface VehicleType {
  name: string
  subtitle?: string
  icon?: string
  maxPassengers?: number
  routes: Route[]
  airportTransfer?: {
    label: string
    price: string
  }
}

interface PricingTableProps {
  vehicleTypes: VehicleType[]
  footnotes?: string[]
}

export default function PricingTable({ vehicleTypes, footnotes }: PricingTableProps) {
  if (!vehicleTypes || vehicleTypes.length === 0) return null

  return (
    <div className="space-y-6">
      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {vehicleTypes.map((vehicle, index) => (
          <div
            key={index}
            className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100"
          >
            {/* Header */}
            <div className="bg-gray-50 p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                {vehicle.icon && (
                  <span className="text-3xl">{vehicle.icon}</span>
                )}
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {vehicle.name}
                  </h3>
                  {vehicle.subtitle && (
                    <p className="text-sm text-gray-500">{vehicle.subtitle}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Routes */}
            <div className="p-6">
              <ul className="space-y-3">
                {vehicle.routes.map((route, routeIndex) => (
                  <li
                    key={routeIndex}
                    className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                  >
                    <span className="text-gray-700">{route.destination}</span>
                    <span className="font-semibold text-gray-900">
                      {route.price}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Airport Transfer */}
              {vehicle.airportTransfer && (
                <div className="mt-4 pt-4 border-t-2 border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 flex items-center gap-2">
                      <span>✈️</span>
                      {vehicle.airportTransfer.label}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {vehicle.airportTransfer.price}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footnotes */}
      {footnotes && footnotes.length > 0 && (
        <div className="text-sm text-gray-500 space-y-1">
          {footnotes.map((note, index) => (
            <p key={index}>* {note}</p>
          ))}
        </div>
      )}
    </div>
  )
}

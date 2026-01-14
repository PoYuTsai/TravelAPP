interface Step {
  step: number
  title: string
  description: string
}

interface ProcessStepsProps {
  steps: Step[]
}

export default function ProcessSteps({ steps }: ProcessStepsProps) {
  if (!steps || steps.length === 0) return null

  // Sort by step number
  const sortedSteps = [...steps].sort((a, b) => a.step - b.step)

  return (
    <div className="relative">
      {/* Connection line - desktop */}
      <div className="hidden md:block absolute top-8 left-0 right-0 h-0.5 bg-gray-200" />

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-4">
        {sortedSteps.map((item, index) => (
          <div key={index} className="relative">
            {/* Step number */}
            <div className="flex md:justify-center mb-4">
              <div className="relative z-10 w-16 h-16 rounded-full bg-primary flex items-center justify-center text-2xl font-bold text-black shadow-md">
                {item.step}
              </div>
            </div>

            {/* Content */}
            <div className="md:text-center">
              <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {item.description}
              </p>
            </div>

            {/* Mobile arrow */}
            {index < sortedSteps.length - 1 && (
              <div className="md:hidden flex justify-center my-4">
                <svg
                  className="w-6 h-6 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

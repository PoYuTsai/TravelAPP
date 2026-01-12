import Button from '@/components/ui/Button'

interface InlineCTAProps {
  title?: string
  description?: string
}

export default function InlineCTA({
  title = '想了解更多？',
  description = '免費諮詢行程規劃，讓在地人帶你玩清邁',
}: InlineCTAProps) {
  return (
    <div className="my-8 p-6 bg-primary-light border-l-4 border-primary rounded-r-lg">
      <p className="font-medium text-gray-900 mb-1">{title}</p>
      <p className="text-gray-600 text-sm mb-3">{description}</p>
      <Button href="https://line.me/R/ti/p/@037nyuwk" external size="sm">
        LINE 諮詢
      </Button>
    </div>
  )
}

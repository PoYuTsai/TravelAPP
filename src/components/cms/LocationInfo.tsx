interface LocationInfoProps {
  description?: string
  fromChiangMai?: string
  googleMapUrl?: string
}

export default function LocationInfo({
  description,
  fromChiangMai,
  googleMapUrl,
}: LocationInfoProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="text-4xl">📍</div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-4">位置資訊</h3>

            {description && (
              <p className="text-gray-600 leading-relaxed mb-4 whitespace-pre-line">
                {description}
              </p>
            )}

            {fromChiangMai && (
              <div className="flex items-center gap-2 text-gray-700 mb-4">
                <span className="text-xl">🚗</span>
                <span>從清邁出發：{fromChiangMai}</span>
              </div>
            )}

            {googleMapUrl && (
              <a
                href={googleMapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-black px-6 py-3 rounded-full font-medium transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                在 Google Maps 查看
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Map Embed (optional - can be added if needed) */}
      {googleMapUrl && (
        <div className="border-t border-gray-100">
          <iframe
            src={`https://www.google.com/maps?q=${encodeURIComponent('Huen San Fang Hotel, Fang, Chiang Mai')}&output=embed`}
            width="100%"
            height="300"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="民宿位置"
          />
        </div>
      )}
    </div>
  )
}

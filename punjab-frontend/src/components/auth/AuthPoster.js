export default function AuthPoster() {
  return (
    <div className="hidden lg:flex flex-col w-full max-w-md bg-gradient-to-br from-primary to-primary-container rounded border border-outline-variant/40 p-10 text-on-primary items-center justify-center space-y-8">
      {/* Parliament Icon */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-on-primary/10 rounded-full mb-4">
          <i className="fa-solid fa-gopuram text-3xl text-secondary-container" />
        </div>
        <h3 className="font-display-lg text-3xl tracking-tight leading-tight">
          Punjab Politics
        </h3>
        <p className="font-body-lg mt-3 text-on-primary/90">
          The Definitive Chronicle of Indian Political Discourse
        </p>
      </div>

      {/* Features */}
      <div className="space-y-5 w-full">
        <div className="flex gap-3 items-start">
          <i className="fa-solid fa-check-circle text-secondary-container text-xl flex-shrink-0 mt-1" />
          <div>
            <p className="font-label-md text-on-primary">Verified Political Analysis</p>
          </div>
        </div>
        <div className="flex gap-3 items-start">
          <i className="fa-solid fa-clock text-secondary-container text-xl flex-shrink-0 mt-1" />
          <div>
            <p className="font-label-md text-on-primary">Real-time Election Coverage</p>
          </div>
        </div>
        <div className="flex gap-3 items-start">
          <i className="fa-solid fa-people-group text-secondary-container text-xl flex-shrink-0 mt-1" />
          <div>
            <p className="font-label-md text-on-primary">Community-driven Discourse</p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="w-full h-1 bg-gradient-to-r from-error via-secondary-container to-primary rounded-full" />

      {/* Footer */}
      <p className="text-sm font-body-md text-on-primary/80 text-center">
        Join a movement towards authentic political dialogue
      </p>
    </div>
  );
}

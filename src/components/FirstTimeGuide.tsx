import React, { useState } from "react";
import {
  X,
  Check,
  User,
  Settings,
  Calendar,
  ClipboardList,
  ArrowLeftRight,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Home,
} from "lucide-react";

interface FirstTimeGuideProps {
  onClose: () => void;
  onComplete: () => void;
}

const steps = [
  {
    id: 1,
    title: "Welkom bij Het Verband Ternat Planner",
    description:
      "Dit is een zelf-gehost planningssysteem voor thuisverpleging. Volg deze korte handleiding om snel aan de slag te gaan.",
    icon: Home,
    color: "blue",
  },
  {
    id: 2,
    title: "Log in met standaard account",
    description:
      "Gebruik het standaard beheerdersaccount om in te loggen: admin@homenursing.org met wachtwoord admin123. Wijzig dit wachtwoord direct na de eerste login.",
    icon: User,
    color: "amber",
    credentials: true,
  },
  {
    id: 3,
    title: "Dashboard Overzicht",
    description:
      "Op het dashboard zie je je komende diensten, mededelingen en meldingen. Dit is je startpagina na het inloggen.",
    icon: Calendar,
    color: "green",
  },
  {
    id: 4,
    title: "Dienstregeling Beheren",
    description:
      "In de Dienstregeling sectie kun je diensten aanmaken, bewerken en toewijzen aan medewerkers. Gebruik de kalender om diensten te plannen.",
    icon: Settings,
    color: "purple",
  },
  {
    id: 5,
    title: "Medewerkers Toevoegen",
    description:
      "Voeg medewerkers toe via het Beheercentrum. Ga naar Beheercentrum > Gebruikers om nieuwe accounts aan te maken.",
    icon: User,
    color: "teal",
  },
  {
    id: 6,
    title: "Verlof en Ruil Beheren",
    description:
      "Medewerkers kunnen verlof aanvragen en diensten ruilen. Jij als beheerder kunt deze aanvragen goedkeuren of weigeren.",
    icon: ClipboardList,
    color: "orange",
  },
  {
    id: 7,
    title: "Instellingen Configureren",
    description:
      "Stel je organisatienaam, e-mailinstellingen en andere voorkeuren in via Beheercentrum > Instellingen.",
    icon: Settings,
    color: "indigo",
  },
  {
    id: 8,
    title: "Klaar om te beginnen!",
    description:
      "Je hebt nu een overzicht van de belangrijkste functionaliteiten. Vergeet niet je wachtwoord te wijzigen en begin met het toevoegen van medewerkers en diensten.",
    icon: ShieldCheck,
    color: "emerald",
    isFinal: true,
  },
];

const colorClasses = {
  blue: {
    bg: "bg-blue-50/50",
    border: "border-blue-200",
    icon: "bg-blue-600",
    text: "text-blue-800",
  },
  amber: {
    bg: "bg-amber-50/50",
    border: "border-amber-200",
    icon: "bg-amber-600",
    text: "text-amber-800",
  },
  green: {
    bg: "bg-green-50/50",
    border: "border-green-200",
    icon: "bg-green-600",
    text: "text-green-800",
  },
  purple: {
    bg: "bg-purple-50/50",
    border: "border-purple-200",
    icon: "bg-purple-600",
    text: "text-purple-800",
  },
  teal: {
    bg: "bg-teal-50/50",
    border: "border-teal-200",
    icon: "bg-teal-600",
    text: "text-teal-800",
  },
  orange: {
    bg: "bg-orange-50/50",
    border: "border-orange-200",
    icon: "bg-orange-600",
    text: "text-orange-800",
  },
  indigo: {
    bg: "bg-indigo-50/50",
    border: "border-indigo-200",
    icon: "bg-indigo-600",
    text: "text-indigo-800",
  },
  emerald: {
    bg: "bg-emerald-50/50",
    border: "border-emerald-200",
    icon: "bg-emerald-600",
    text: "text-emerald-800",
  },
};

export default function FirstTimeGuide({ onClose, onComplete }: FirstTimeGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const current = steps[currentStep];
  const totalSteps = steps.length;

  const handleNext = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setTimeout(() => {
      if (currentStep < totalSteps - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        onComplete();
        onClose();
      }
      setIsAnimating(false);
    }, 200);
  };

  const handlePrev = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setTimeout(() => {
      if (currentStep > 0) {
        setCurrentStep(currentStep - 1);
      }
      setIsAnimating(false);
    }, 200);
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 safe-area-inset-top">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={handleClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-blue-600 flex items-center justify-center text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Snelle Start Handleiding</h2>
              <p className="text-xs text-slate-500">
                Stap {currentStep + 1} van {totalSteps}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition active:scale-95"
            title="Sluiten"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8">
          {/* Step Content */}
          <div
            className={`flex flex-col md:flex-row items-center gap-6 transition-all duration-300 ${
              isAnimating ? "opacity-50 scale-95" : "opacity-100 scale-100"
            }`}
          >
            {/* Icon */}
            <div
              className={`h-16 w-16 rounded-2xl flex items-center justify-center text-white shrink-0 ${
                colorClasses[current.color as keyof typeof colorClasses].icon
              }`}
            >
              <current.icon className="h-8 w-8" />
            </div>

            {/* Text Content */}
            <div className="flex-1 text-center md:text-left">
              <h3 className={`text-xl font-bold mb-2 ${
                colorClasses[current.color as keyof typeof colorClasses].text
              }`}>
                {current.title}
              </h3>
              <p className="text-slate-600 leading-relaxed">
                {current.description}
              </p>

              {/* Credentials Display */}
              {current.credentials && (
                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200/50">
                  <p className="text-xs text-slate-500 mb-1">Standaard inloggegevens:</p>
                  <div className="space-y-1">
                    <code className="text-sm font-mono text-blue-700 bg-blue-50/50 px-2 py-1 rounded">
                      admin@homenursing.org
                    </code>
                    <code className="text-sm font-mono text-blue-700 bg-blue-50/50 px-2 py-1 rounded block">
                      admin123
                    </code>
                  </div>
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠️ Wijzig dit wachtwoord direct na de eerste login!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-2">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    index <= currentStep
                      ? `bg-${current.color}-600`
                      : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Start</span>
              <span>Klaar</span>
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-semibold text-sm transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
            Terug
          </button>

          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-white font-semibold text-sm transition active:scale-95 shadow-xs"
          >
            {current.isFinal ? (
              <>
                <Check className="h-4 w-4" />
                Afronden
              </>
            ) : (
              <>
                Volgende
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

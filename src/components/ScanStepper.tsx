import React from 'react';
import { cn } from '@/lib/utils';

interface ScanStepperProps {
  currentStep: 1 | 2 | 3 | 4 | 5;
}

export const ScanStepper: React.FC<ScanStepperProps> = ({ currentStep }) => {
  const steps = [
    { number: 1, label: 'Address' },
    { number: 2, label: 'Satellite View' },
    { number: 3, label: 'Trace Roof' },
    { number: 4, label: 'Mark Obstacles' },
    { number: 5, label: 'Analysis' },
  ];

  return (
    <div className="w-full bg-[#0A0A0A]/90 border-b border-white/10 py-3.5 px-6 backdrop-blur-2xl">
      {/* Mobile Stepper View */}
      <div className="sm:hidden text-center">
        <span className="text-xs font-mono text-white/50">
          Step {currentStep} of 5 —{' '}
          <span className="text-[#FF6600] font-bold">
            {steps[currentStep - 1].label}
          </span>
        </span>
      </div>

      {/* Desktop Stepper View */}
      <div className="hidden sm:flex items-center justify-between max-w-3xl mx-auto">
        {steps.map((step, index) => {
          const isCompleted = step.number < currentStep;
          const isActive = step.number === currentStep;

          return (
            <React.Fragment key={step.number}>
              {/* Step Circle & Label */}
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all border',
                    isCompleted && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
                    isActive && 'bg-[#FF6600]/15 border-[#FF6600] text-[#FF6600] shadow-[0_0_12px_rgba(255,102,0,0.4)]',
                    !isCompleted && !isActive && 'bg-white/5 border-white/10 text-white/40'
                  )}
                >
                  {isCompleted ? '✓' : step.number}
                </div>
                <span
                  className={cn(
                    'text-xs font-mono font-bold transition-all',
                    isCompleted && 'text-white/60',
                    isActive && 'text-[#FF6600]',
                    !isCompleted && !isActive && 'text-white/30'
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connecting line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-px mx-4 transition-all',
                    step.number < currentStep ? 'bg-emerald-500/40' : 'bg-white/10'
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};


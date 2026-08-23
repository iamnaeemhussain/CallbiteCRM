import React from 'react';
import { CardSim } from 'lucide-react';

export const SimCard: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => {
  return <CardSim className={className} />;
};

export default SimCard;

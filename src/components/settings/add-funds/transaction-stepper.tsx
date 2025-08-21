"use client";
import { CheckCircle, Clock, Loader, XCircle } from 'lucide-react';
import React from 'react';

const stepLabels = [
    'Processing transaction',
    'Swapping to SkyUSD',
    'Adding balance to your agent'
];

export const TransactionStepper = ({ statuses }: { statuses: ('pending' | 'processing' | 'success' | 'failed')[] }) => (
    <div className="flex flex-col gap-2 mb-2">
        {stepLabels.map((label, idx) => {
            const status = statuses[idx];
            let icon;
            if (status === 'processing') icon = <Loader className="animate-spin" size={18} color="#4ade80" />;
            else if (status === 'success') icon = <CheckCircle size={18} color="#4ade80" />;
            else if (status === 'failed') icon = <XCircle size={18} color="#ef4444" />;
            else icon = <Clock size={18} color="#a1a1aa" />;
            return (
                <div key={label} className={`flex items-center gap-2 text-foreground ${status === 'pending' ? 'opacity-70' : 'opacity-100'}`}>
                    {icon}
                    <span className={`text-sm font-normal tracking-wide ${
                        status === 'success' ? 'text-green-400' : 
                        status === 'failed' ? 'text-red-500' : 
                        'text-foreground'
                    }`}>
                        {label}
                    </span>
                </div>
            );
        })}
    </div>
); 
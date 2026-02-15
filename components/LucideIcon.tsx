"use client";

import * as Icons from "lucide-react";
import { LucideProps } from "lucide-react";

interface LucideIconProps extends LucideProps {
    name: string;
}

const LucideIcon = ({ name, ...props }: LucideIconProps) => {
    const IconComponent = (Icons as any)[name];

    if (!IconComponent) {
        return <Icons.HelpCircle {...props} />;
    }

    return <IconComponent {...props} />;
};

export default LucideIcon;

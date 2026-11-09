'use client';

import { usePathname } from 'next/navigation';
import PrototypeExperience from '@/components/PrototypeExperience';

export default function PrototypeFrame({ markup }: { markup: string }) {
  const pathname = usePathname() || '/overview';
  return <PrototypeExperience markup={markup} pathname={pathname} />;
}

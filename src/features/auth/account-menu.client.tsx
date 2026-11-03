"use client";

import { LogOut } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { AvatarMenu } from "@/components/layout/avatar-menu";
import type { MenuGroup } from "@/components/layout/nav-types";
import { Icon } from "@/components/ui/icon";
import { notify } from "@/lib/notify";
import { useSignOut } from "./use-sign-out.client";

export type AccountMenuProps = {
  triggerLabel: string;
  name: string;
  email?: string;
  initials: string;
  roleLabel?: string;
  roleTone?: "default" | "admin";
  /** The workspace and account links, built by the caller; each carries its own icon. */
  groups: { label?: string; entries: { label: string; href: string; icon: ReactNode }[] }[];
  signOut: {
    label: string;
    /** Shown in a toast if the server could not end the session. */
    failedText: string;
    /** Customers go to "/"; staff to their own sign-in page. */
    destination: string;
  };
};

/**
 * The signed-in person's menu in the header: the shared AvatarMenu with a Sign out entry that ends
 * this browser's session (ADD-05/06, S3-T09). If the server cannot end it the person stays where
 * they are and is told so; they must never be told they are signed out when they are not.
 */
export function AccountMenu({ groups, signOut: signOutText, ...person }: AccountMenuProps) {
  const { signOut, failed } = useSignOut(signOutText.destination);
  const { failedText } = signOutText;

  useEffect(() => {
    if (failed) notify.error(failedText);
  }, [failed, failedText]);

  const menuGroups: MenuGroup[] = [
    ...groups.map((group) => ({
      ...(group.label ? { label: group.label } : {}),
      items: group.entries,
    })),
    {
      items: [
        {
          label: signOutText.label,
          icon: <Icon icon={LogOut} />,
          onSelect: signOut,
          destructive: true,
        },
      ],
    },
  ];

  return <AvatarMenu {...person} groups={menuGroups} />;
}

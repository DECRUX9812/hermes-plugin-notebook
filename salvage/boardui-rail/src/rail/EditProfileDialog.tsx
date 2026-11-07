import { RiFlashlightLine, RiPencilLine, RiShieldCheckLine, RiTaskLine } from "@remixicon/react";
import { Avatar } from "@/components/base/avatar/avatar";
import { Button } from "@/components/base/buttons/button";
import { Chip } from "@/components/base/badges/chip";
import {
  Modal,
  ModalBody,
  ModalDialog,
  ModalFooter,
  ModalHeader,
} from "@/components/base/modal/modal";
import type { Bot } from "../fixtures";

const STATS: Record<string, { label: string; value: string; icon: typeof RiTaskLine }> = {
  tasks: { label: "Tasks today", value: "14", icon: RiTaskLine },
  approvals: { label: "Approvals answered", value: "3", icon: RiShieldCheckLine },
  streak: { label: "Working streak", value: "6 days", icon: RiFlashlightLine },
};

export function EditProfileDialog({ bot }: { bot: Bot }) {
  return (
    <Modal size="sm" aria-label={`Edit ${bot.name} profile`}>
      <ModalDialog>
        <ModalHeader
          title={
            <span className="flex items-center gap-3">
              <Avatar color={bot.color} initials={bot.initials} size="lg" />
              <span>
                <span className="block text-headline-medium text-text-primary">{bot.name}</span>
                <span className="block text-body-2-regular text-text-secondary">{bot.statusLine}</span>
              </span>
            </span>
          }
        />
        <ModalBody>
          <div className="grid grid-cols-3 gap-2">
            {Object.values(STATS).map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border-button-default bg-background-secondary-default p-3 text-center"
              >
                <stat.icon className="mx-auto size-4 text-foreground-icon-tertiary" aria-hidden />
                <p className="mt-1 text-headline-semibold text-text-primary">{stat.value}</p>
                <p className="text-caption-1-regular text-text-tertiary">{stat.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-caption-1-medium text-text-tertiary">Personality</span>
            <Chip color={bot.color === "pink" ? "rose" : "blue"} variant="caption">
              careful verifier
            </Chip>
            <Chip color="soft" variant="caption">
              responds in 1 message
            </Chip>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" leadingIcon={RiPencilLine}>
            Edit profile
          </Button>
          <Button variant="primary">Open chat</Button>
        </ModalFooter>
      </ModalDialog>
    </Modal>
  );
}

"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import { MemberForm } from "@/components/members/member-form";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type Option = {
  id: string;
  name: string;
};

type AddMemberPanelProps = {
  departments: Option[];
  homecells: Option[];
};

export function AddMemberPanel({ departments, homecells }: AddMemberPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Add Member Profile</CardTitle>
          <CardDescription className="mt-1">
            Capture personal, contact, residence, demographic, discipleship, baptism, and involvement details.
          </CardDescription>
        </div>
        <Button type="button" variant={open ? "secondary" : "default"} onClick={() => setOpen((value) => !value)}>
          {open ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
          {open ? "Close Form" : "Add Member"}
        </Button>
      </div>

      {open ? (
        <div className="mt-4">
          <MemberForm mode="create" departments={departments} homecells={homecells} />
        </div>
      ) : null}
    </Card>
  );
}

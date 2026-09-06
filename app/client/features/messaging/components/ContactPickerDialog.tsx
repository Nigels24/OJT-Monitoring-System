import { MessageSquarePlus } from "lucide-react";
import ViewDialog from "@/components/ui/ViewDialog";
import SearchInput from "@/components/ui/SearchInput";
import Avatar from "@/components/ui/Avatar";
import { Contact } from "@/lib/api/messagesApi";

interface ContactPickerDialogProps {
  open: boolean;
  contacts: Contact[];
  isLoading: boolean;
  isCreating: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (contact: Contact) => void;
  onClose: () => void;
}

export default function ContactPickerDialog({
  open,
  contacts,
  isLoading,
  isCreating,
  search,
  onSearchChange,
  onSelect,
  onClose,
}: ContactPickerDialogProps) {
  return (
    <ViewDialog
      open={open}
      title="New Message"
      icon={MessageSquarePlus}
      onClose={onClose}
    >
      <SearchInput
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by name..."
      />

      <div className="max-h-80 overflow-y-auto -mx-2 mt-2">
        {isLoading ? (
          <p className="text-gray-400 text-sm py-4 px-2">Loading...</p>
        ) : contacts.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">
            No one matches that search.
          </p>
        ) : (
          contacts.map((contact) => (
            <button
              key={contact.id}
              disabled={isCreating}
              onClick={() => onSelect(contact)}
              className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-left hover:bg-gray-50 disabled:opacity-50"
            >
              <Avatar name={contact.name} size={36} />
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {contact.name}
                </p>
                <p className="text-xs text-gray-400 capitalize">
                  {contact.role.toLowerCase()}
                  {contact.establishmentName
                    ? ` · ${contact.establishmentName}`
                    : ""}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </ViewDialog>
  );
}

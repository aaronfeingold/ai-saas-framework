'use client';

import { useState } from 'react';

import { AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsCard } from '@/components/ui/settings-card';

import { deleteAccount } from '../../profile/actions';

export function DeleteAccountForm() {
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (confirmationText !== 'DELETE') {
      toast.error('Please type "DELETE" to confirm');
      return;
    }

    setIsDeleting(true);

    try {
      const result = await deleteAccount();

      if (result?.error) {
        toast.error(result.error);
      }
      // If successful, the action will redirect
    } catch {
      toast.error('Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const isConfirmationValid = confirmationText === 'DELETE';

  return (
    <SettingsCard
      title="Delete Account"
      description="Permanently delete your account and all associated data."
      className="border-destructive"
    >
      <div className="space-y-4">
        <div className="bg-destructive/10 border-destructive/20 flex items-start gap-3 rounded-md border p-4">
          <AlertTriangle className="text-destructive mt-0.5 h-5 w-5" />
          <div>
            <h4 className="text-destructive text-sm font-medium">
              This action cannot be undone
            </h4>
            <p className="text-destructive/80 mt-1 text-sm">
              Deleting your account will permanently remove all your data,
              including your profile, settings, chat history, and any uploaded
              files. This action is irreversible.
            </p>
          </div>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete My Account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  This action cannot be undone. This will permanently delete
                  your account and remove all your data from our servers.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="confirmation">
                    Type <strong>DELETE</strong> to confirm:
                  </Label>
                  <Input
                    id="confirmation"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    placeholder="DELETE"
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmationText('')}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAccount}
                disabled={!isConfirmationValid || isDeleting}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isDeleting ? 'Deleting...' : 'Delete Account'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SettingsCard>
  );
}

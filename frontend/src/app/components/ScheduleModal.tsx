import { useState } from "react";
import { Clock, X } from "lucide-react";
import { Button, Field, Label, Description, Input } from "./FormComponents";
import { CustomSelect } from "./CustomSelect";

type Platform = "substack" | "linkedin" | "instagram" | "threads";

type ScheduleModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (date: string, time: string, timezone: string, platforms?: Platform[]) => void;
  platform?: Platform;
  multiPlatform?: boolean;
  title?: string;
  description?: string;
};

export function ScheduleModal({ 
  isOpen, 
  onClose, 
  onSchedule, 
  platform,
  multiPlatform = false,
  title = "Schedule Post",
  description = "Posts will be published automatically at the scheduled time. You can view and manage scheduled posts in the Marketing dashboard."
}: ScheduleModalProps) {
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleTimezone, setScheduleTimezone] = useState("America/Los_Angeles");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(
    multiPlatform ? ["substack", "linkedin", "instagram", "threads"] : platform ? [platform] : []
  );

  const timezones = [
    { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
    { value: "America/Denver", label: "Mountain Time (MT)" },
    { value: "America/Chicago", label: "Central Time (CT)" },
    { value: "America/New_York", label: "Eastern Time (ET)" },
    { value: "Europe/London", label: "London (GMT)" },
    { value: "Europe/Paris", label: "Paris (CET)" },
    { value: "Asia/Tokyo", label: "Tokyo (JST)" },
    { value: "Australia/Sydney", label: "Sydney (AEDT)" }
  ];

  const handleSubmit = () => {
    onSchedule(scheduleDate, scheduleTime, scheduleTimezone, multiPlatform ? selectedPlatforms : undefined);
    setScheduleDate("");
    setScheduleTime("");
    setScheduleTimezone("America/Los_Angeles");
  };

  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms(prev => 
      prev.includes(platform) 
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl"
        style={{ background: 'var(--card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(var(--primary-rgb), 0.1)' }}
              >
                <Clock className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                  {title}
                </h2>
                {multiPlatform && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                    Schedule to multiple platforms
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-all hover:bg-black/5"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Platform Selection (Multi-platform only) */}
          {multiPlatform && (
            <Field>
              <Label>Select platforms</Label>
              <Description>
                Choose which social platforms to publish this post to.
              </Description>
              <div className="grid grid-cols-2 gap-2">
                {(["substack", "linkedin", "instagram", "threads"] as Platform[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className="px-3 py-2 rounded-lg text-sm font-semibold transition-all capitalize"
                    style={{
                      background: selectedPlatforms.includes(p) ? 'var(--primary)' : 'var(--secondary)',
                      color: selectedPlatforms.includes(p) ? '#fff' : 'var(--muted-foreground)',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: selectedPlatforms.includes(p) ? 'var(--primary)' : 'rgba(var(--border-rgb), 0.12)'
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Field>
          )}

          {/* Form Fields */}
          <Field>
            <Label htmlFor="schedule-date">Publication date</Label>
            <Description>
              Choose when you want this post to go live.
            </Description>
            <Input
              id="schedule-date"
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
            />
          </Field>

          <Field>
            <Label htmlFor="schedule-time">Publication time</Label>
            <Description>
              Select the exact time for publishing.
            </Description>
            <Input
              id="schedule-time"
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
            />
          </Field>

          <Field>
            <Label htmlFor="schedule-timezone">Timezone</Label>
            <Description>
              Posts will publish at this time in your selected timezone.
            </Description>
            <CustomSelect
              id="schedule-timezone"
              options={timezones}
              value={scheduleTimezone}
              onChange={setScheduleTimezone}
            />
          </Field>

          <Description>
            {description}
          </Description>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={onClose}
              style={{ flex: 1 }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!scheduleDate || !scheduleTime || (multiPlatform && selectedPlatforms.length === 0)}
              style={{ flex: 1 }}
            >
              Confirm Schedule
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
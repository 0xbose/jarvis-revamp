"use client"
import { useEffect, useState, useCallback, useMemo } from "react"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import { Clock, Activity, Settings, Zap, Copy, Pencil, Check, X } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { useParams, useSearchParams } from "next/navigation"
import { getAgentDetailByCollectionAndNftId } from "@/controllers/agents/agents.query"
import { updateUserAgent } from "@/controllers/agents/agent.mutations"
import { AgentImage } from "@/components/market-place/agent-image"

// Custom hooks for better separation of concerns
const useAgentData = (agentAddress: string, nftId: string) => {
  return useQuery({
    queryKey: ["user-agents-collection-by-address", agentAddress, nftId],
    queryFn: async () => {
      if (!agentAddress) return null
      const data = await getAgentDetailByCollectionAndNftId(agentAddress, nftId)
      return data || null
    },
    enabled: !!agentAddress,
    staleTime: 0,
    gcTime: 0,
    retry: 3,
  })
}

const useEditableField = (initialValue: string, onSave: (value: string) => Promise<void>) => {
  const [value, setValue] = useState(initialValue)
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(initialValue)

  const startEdit = useCallback(() => {
    setDraft(value)
    setIsEditing(true)
  }, [value])

  const cancelEdit = useCallback(() => {
    setDraft(value)
    setIsEditing(false)
  }, [value])

  const saveEdit = useCallback(async () => {
    if (draft === value) {
      setIsEditing(false)
      return
    }
    
    try {
      await onSave(draft)
      setValue(draft)
      setIsEditing(false)
    } catch (error) {
      // Error handling is done in the parent component
      throw error
    }
  }, [draft, value, onSave])

  // Update local state when initial value changes
  useEffect(() => {
    setValue(initialValue)
    if (!isEditing) {
      setDraft(initialValue)
    }
  }, [initialValue, isEditing])

  return {
    value,
    draft,
    isEditing,
    setDraft,
    startEdit,
    cancelEdit,
    saveEdit
  }
}

const EditableInput = ({ 
  value, 
  draft, 
  isEditing, 
  onChange, 
  onSave, 
  onCancel, 
  onEdit,
  className = "",
  placeholder = "",
  multiline = false
}: {
  value: string
  draft: string
  isEditing: boolean
  onChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
  onEdit: () => void
  className?: string
  placeholder?: string
  multiline?: boolean
}) => {
  if (isEditing) {
    const InputComponent = multiline ? "textarea" : "input"
    return (
      <div className="flex items-start gap-2">
        <InputComponent
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          className={`bg-transparent border-b border-border focus:outline-none focus:border-primary ${className}`}
          placeholder={placeholder}
          autoFocus
          {...(multiline && { rows: 4 })}
        />
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={onSave} className="h-8 w-8">
            <Check className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onCancel} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className={className}>{value || placeholder}</span>
      <Button size="icon" variant="ghost" onClick={onEdit} className="h-8 w-8">
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
  )
}

const StatusInfo = ({ icon, text, className = "" }: { 
  icon: React.ReactNode, 
  text: string, 
  className?: string 
}) => (
  <div className={`flex items-center gap-2 ${className}`}>
    {icon}
    <span>{text}</span>
  </div>
)

const AddressInfo = ({ label, value, onCopy }: { 
  label: string, 
  value?: string, 
  onCopy: () => void 
}) => (
  <div className="space-y-3">
    <div className="flex flex-col">
      <Label className="font-medium text-muted-foreground tracking-wide">
        {label}
      </Label>
      <div className="flex items-center gap-1">
        <code className="text-sm font-mono text-foreground">
          {value && typeof value === "string" && value.length > 10
            ? `${value.slice(0, 8)}...${value.slice(-6)}`
            : value || "N/A"}
        </code>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCopy}
          className="h-8 w-8 p-0 hover:bg-background/80 active:scale-80 transition-transform duration-100"
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  </div>
)

export default function Page() {
  const params = useParams<{ agentAddress: string }>()
  const agentAddress = params.agentAddress
  const searchParams = useSearchParams()
  const nftId = searchParams.get("nftid") || ""

  const [updateLoading, setUpdateLoading] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const { data: agentData, refetch } = useAgentData(agentAddress, nftId)

  // The updateAgent function now only passes the changed field along with required previous data
  const updateAgent = useCallback(
    async (updates: Partial<{ name: string; description: string }>) => {
      if (!agentData) return

      setUpdateLoading(true)
      setUpdateError(null)

      try {
        // Build the payload with only the changed field and required previous data
        const payload = {
          collection_address: agentData.collection_id || agentAddress,
          nft_id: agentData.id || nftId,
          name: updates.name !== undefined ? updates.name : agentData.name || "",
          description: updates.description !== undefined ? updates.description : agentData.description || "",
          image: agentData.image || "",
        }

        // Debug log
        console.log('Updating agent with payload:', payload)

        // Use user_address if available, otherwise fallback to empty string
        await updateUserAgent(agentData.user_address || "", payload)
        
        await refetch()
      } catch (err: any) {
        console.error('Update error:', err) // Debug log
        const errorMessage = err?.message || `Failed to update agent ${Object.keys(updates)[0]}.`
        setUpdateError(errorMessage)
        throw err
      } finally {
        setUpdateLoading(false)
      }
    },
    [agentData, agentAddress, nftId, refetch]
  )

  const updateName = useCallback((name: string) => {
    return updateAgent({ name })
  }, [updateAgent])

  const updateDescription = useCallback((description: string) => {
    return updateAgent({ description })
  }, [updateAgent])

  const nameField = useEditableField(agentData?.name || "", updateName)
  const descriptionField = useEditableField(agentData?.description || "", updateDescription)

  const handleCopyAddress = useCallback(() => {
    const addressToCopy = agentData?.collection_id || agentData?.id || ""
    navigator.clipboard.writeText(addressToCopy)
  }, [agentData?.collection_id, agentData?.id])

  // Memoize formatted date to prevent recalculation
  const formattedDate = useMemo(() => {
    if (!agentData?.updated_at) return "Unknown"
    return new Date(agentData.updated_at).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }, [agentData?.updated_at])

  const statusInfo = useMemo(
    () => [
      {
        icon: <Activity className="w-4 h-4 text-green-500" />,
        text: agentData?.is_deployed ? "Deployed" : "Not Deployed",
      },
      {
        icon: <Clock className="w-4 h-4" />,
        text: `Updated ${formattedDate}`,
      },
      {
        icon: <Settings className="w-4 h-4" />,
        text: `${agentData?.subnet_list?.length || 0} subnets configured`,
      },
    ],
    [agentData?.is_deployed, agentData?.subnet_list?.length, formattedDate]
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-12 max-w-7xl flex flex-col gap-8">
        {/* Error Display */}
        {updateError && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg">
            {updateError}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-12 items-start justify-between">
          <div className="flex flex-col md:flex-row gap-8 items-start flex-1">
            <AgentImage
              src={agentData?.image}
              alt="Agent"
              isVerified={agentData?.isVerified}
            />

            <div className="flex-1 space-y-6">
              <div className="space-y-4">
                <EditableInput
                  value={nameField.value}
                  draft={nameField.draft}
                  isEditing={nameField.isEditing}
                  onChange={nameField.setDraft}
                  onSave={nameField.saveEdit}
                  onCancel={nameField.cancelEdit}
                  onEdit={nameField.startEdit}
                  className="text-4xl font-bold text-foreground tracking-tight"
                  placeholder="Agent Name"
                />

                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  {statusInfo.map((info, index) => (
                    <StatusInfo key={index} icon={info.icon} text={info.text} />
                  ))}
                </div>
              </div>

              <div className="flex gap-x-10">
                <AddressInfo
                  label="Collection Address"
                  value={agentData?.collection_id}
                  onCopy={handleCopyAddress}
                />
                <AddressInfo
                  label="Agent ID"
                  value={agentData?.id}
                  onCopy={handleCopyAddress}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-lg font-semibold text-foreground">
              Agent Description
            </Label>
            {!descriptionField.isEditing && (
              <Button
                size="sm"
                variant="ghost"
                onClick={descriptionField.startEdit}
                className="h-8 px-2"
                disabled={updateLoading}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="relative">
            <div className="min-h-[140px] bg-background/50 border border-border/60 rounded-xl p-6 text-base leading-relaxed">
              {descriptionField.isEditing ? (
                <div className="space-y-4">
                  <textarea
                    value={descriptionField.draft}
                    onChange={(e) => descriptionField.setDraft(e.target.value)}
                    className="w-full min-h-[120px] bg-transparent outline-none focus:outline-none resize-y"
                    placeholder="Enter a description for this agent..."
                    disabled={updateLoading}
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={descriptionField.saveEdit}
                      className="h-8 px-3"
                      disabled={updateLoading}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      {updateLoading ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={descriptionField.cancelEdit}
                      className="h-8 px-3"
                      disabled={updateLoading}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>{descriptionField.value || "No description provided for this agent."}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
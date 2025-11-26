import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, Square, Camera, RotateCcw, Check, Loader2, Play, Pause } from "lucide-react";
import { LOCATIONS, PRIORITIES, MAINTENANCE_GROUPS } from "@/lib/mockData";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

// Steps in the workflow
type Step = "capture" | "processing" | "review" | "success";

export default function CreateTask() {
  const [step, setStep] = useState<Step>("capture");
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [transcript, setTranscript] = useState("");
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  // Mock Form Data (Pre-filled by AI)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    originalTranscript: "",
    priority: "Normal",
    locationId: "",
    assignedGroup: "",
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Recording Timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = () => {
    // Check if browser supports Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast({
        title: "Speech Recognition Not Supported",
        description: "Please use the text input instead or try a different browser.",
        variant: "destructive",
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'fr-FR'; // Default to French, but will accept any language

    let finalTranscript = '';

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPiece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptPiece + ' ';
        } else {
          interimTranscript += transcriptPiece;
        }
      }
      
      setTranscript(finalTranscript + interimTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      toast({
        title: "Recording Error",
        description: "Could not capture audio. Please try again.",
        variant: "destructive",
      });
      setIsRecording(false);
    };

    recognition.onend = () => {
      if (isRecording) {
        recognition.start();
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    
    setIsRecording(true);
    setRecordingTime(0);
    setAudioUrl(null);
    setTranscript('');
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    
    setIsRecording(false);
    
    if (transcript.trim()) {
      setAudioUrl("recorded");
      toast({
        title: "Recording saved",
        description: "Your voice message has been captured.",
      });
    } else {
      toast({
        title: "No Speech Detected",
        description: "Please try recording again.",
        variant: "destructive",
      });
    }
  };

  const takePhoto = () => {
    // Trigger the hidden file input
    fileInputRef.current?.click();
  };

  const handlePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    // Convert to base64 for preview and storage
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPhoto(base64String);
      toast({
        title: "Photo captured",
        description: "Image attached to the task.",
      });
    };
    reader.readAsDataURL(file);
  };

  const processAI = async () => {
    const inputText = transcript.trim() || textInput.trim();
    
    if (!inputText && !photo) {
      toast({
        title: "Missing Input",
        description: "Please record a voice message, type a description, or take a photo.",
        variant: "destructive",
      });
      return;
    }

    setStep("processing");
    setIsProcessing(true);

    try {
      const response = await fetch("/api/ai/process-task", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: inputText,
          hasPhoto: !!photo,
        }),
      });

      if (!response.ok) {
        throw new Error("AI processing failed");
      }

      const data = await response.json();
      
      setFormData({
        title: data.title,
        description: data.description,
        originalTranscript: inputText,
        priority: data.priority || "Normal",
        locationId: data.locationId || "",
        assignedGroup: data.assignedGroup || "",
      });
      
      setIsProcessing(false);
      setStep("review");
    } catch (error) {
      console.error("AI processing error:", error);
      toast({
        title: "Processing Failed",
        description: "Could not process your request. Please try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
      setStep("capture");
    }
  };

  const submitTask = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) {
        toast({
          title: "Not authenticated",
          description: "Please log in to create tasks.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const user = JSON.parse(userStr);

      const taskData = {
        title: formData.title,
        description: formData.description,
        originalTranscript: formData.originalTranscript,
        locationId: formData.locationId,
        priority: formData.priority,
        assignedGroup: formData.assignedGroup,
        imageUrl: photo,
        createdBy: user.id,
      };

      console.log("Submitting task:", { ...taskData, imageUrl: photo ? `[image: ${photo.substring(0, 50)}...]` : null });

      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(taskData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Server error:", errorData);
        throw new Error(errorData.error || "Failed to create task");
      }

      const result = await response.json();
      console.log("Task created successfully:", result);

      toast({
        title: "Task Created Successfully",
        description: "The maintenance team has been notified.",
      });
      setStep("success");
      setTimeout(() => navigate("/"), 2000);
    } catch (error) {
      console.error("Submit task error:", error);
      toast({
        title: "Failed to Create Task",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <Layout userRole="Basic Staff">
      <div className="max-w-xl mx-auto px-0 sm:px-4">
        <div className="mb-6 sm:mb-8 text-center">
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-primary mb-2">New Task</h1>
          <p className="text-sm sm:text-base text-muted-foreground px-2">
            Record a voice message describing the issue. The AI will fill out the form for you.
          </p>
        </div>

        {/* Step 1: Capture */}
        {step === "capture" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Voice Recorder Card */}
            <Card className="border-2 border-dashed border-primary/20 bg-muted/30">
              <CardContent className="flex flex-col items-center justify-center py-12 space-y-6">
                {isRecording ? (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                      <div className="h-24 w-24 rounded-full bg-red-500 flex items-center justify-center shadow-lg z-10 relative">
                        <Mic className="h-10 w-10 text-white" />
                      </div>
                    </div>
                    <div className="text-2xl font-mono font-medium text-primary">
                      {formatTime(recordingTime)}
                    </div>
                    <p className="text-sm text-muted-foreground animate-pulse">Recording...</p>
                    <Button 
                      size="lg" 
                      variant="destructive" 
                      className="w-40 rounded-full mt-4"
                      onClick={stopRecording}
                    >
                      <Square className="h-4 w-4 mr-2 fill-current" /> Stop
                    </Button>
                  </div>
                ) : (
                  <>
                    {audioUrl ? (
                      <div className="flex flex-col items-center space-y-4 w-full">
                         <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-2">
                           <Check className="h-8 w-8 text-green-600" />
                         </div>
                         <p className="font-medium text-green-700">Audio Captured</p>
                         <div className="flex gap-3">
                            <Button variant="outline" onClick={() => setAudioUrl(null)}>
                              <RotateCcw className="h-4 w-4 mr-2" /> Retake
                            </Button>
                            <Button variant="secondary" className="gap-2">
                              <Play className="h-4 w-4" /> Play
                            </Button>
                         </div>
                      </div>
                    ) : (
                      <>
                        <Button 
                          size="lg" 
                          className="h-24 w-24 rounded-full bg-primary hover:bg-primary/90 shadow-xl hover:scale-105 transition-all duration-300"
                          onClick={startRecording}
                        >
                          <Mic className="h-10 w-10 text-white" />
                        </Button>
                        <p className="text-sm font-medium text-muted-foreground">Tap to Record</p>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Text Input Alternative */}
            <Card className="border-2 border-primary/20 bg-background">
              <CardContent className="p-4">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                  Or Type Your Description
                </label>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Describe the maintenance issue in a few words..."
                  className="w-full p-3 bg-muted/30 rounded-md border border-border text-sm min-h-[80px] focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                  data-testid="input-text-description"
                />
              </CardContent>
            </Card>

            {/* Photo Capture */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoSelected}
            />
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <Button 
                variant="outline" 
                className="h-24 flex flex-col gap-2 border-2 border-dashed hover:border-primary/50 hover:bg-muted/50"
                onClick={takePhoto}
                data-testid="button-add-photo"
              >
                {photo ? (
                   <div className="relative h-full w-full overflow-hidden rounded">
                     <img src={photo} className="h-full w-full object-cover opacity-50" alt="Captured task photo" />
                     <div className="absolute inset-0 flex items-center justify-center">
                        <Check className="h-6 w-6 text-green-600" />
                     </div>
                   </div>
                ) : (
                  <>
                    <Camera className="h-6 w-6 text-muted-foreground" />
                    <span>Add Photo</span>
                  </>
                )}
              </Button>
               <Button 
                className="h-24 flex flex-col gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                disabled={!audioUrl && !photo && !textInput.trim()}
                onClick={processAI}
                data-testid="button-process-task"
              >
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/20 mb-1">
                  <span className="text-lg font-bold">AI</span>
                </div>
                <span>Process Task</span>
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Processing */}
        {step === "processing" && (
          <div className="py-20 flex flex-col items-center justify-center space-y-6 text-center animate-in fade-in zoom-in duration-500">
            <div className="relative h-24 w-24">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">AI</span>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Analyzing Request...</h2>
              <p className="text-muted-foreground max-w-xs mx-auto">
                Transcribing audio, translating content, and extracting task details.
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === "review" && (
          <div className="space-y-4 sm:space-y-6 animate-in slide-in-from-right-8 duration-500">
            <Card className="border-t-4 border-t-primary shadow-lg">
              <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Suggested Title</label>
                  <div className="text-xl font-serif font-bold text-primary">{formData.title}</div>
                </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Location</label>
                      <select 
                        className="w-full p-2 bg-background rounded-md border border-border font-medium text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                        value={formData.locationId}
                        onChange={(e) => setFormData({...formData, locationId: e.target.value})}
                      >
                        <option value="">-- Select Location --</option>
                        {LOCATIONS.map(loc => (
                          <option key={loc.id} value={loc.id}>{loc.name} ({loc.category})</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Priority</label>
                      <select 
                        className="w-full p-2 bg-background rounded-md border border-border font-medium text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                        value={formData.priority}
                        onChange={(e) => setFormData({...formData, priority: e.target.value})}
                      >
                        {Object.keys(PRIORITIES).map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                 </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Who Needs to Fix It?</label>
                  <select 
                    className="w-full p-2 bg-background rounded-md border border-border font-medium text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    value={formData.assignedGroup}
                    onChange={(e) => setFormData({...formData, assignedGroup: e.target.value})}
                  >
                    <option value="">-- Select Group --</option>
                    {MAINTENANCE_GROUPS.map(g => (
                      <option key={g.id} value={g.id}>{g.name} • {g.memberCount} members</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Description (Translated)</label>
                  <textarea 
                    className="w-full p-3 bg-muted/30 rounded-md border border-border text-sm min-h-[100px] focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Original Transcript</label>
                  <p className="text-xs text-muted-foreground italic bg-muted/20 p-3 rounded border border-border/50">
                    "{formData.originalTranscript}"
                  </p>
                </div>
                
                {photo && (
                  <div className="h-32 w-full rounded-lg overflow-hidden border border-border">
                    <img src={photo} className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <Button 
                    variant="outline" 
                    className="flex-1" 
                    onClick={() => setStep("capture")}
                    disabled={isSubmitting}
                    data-testid="button-cancel-task"
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="flex-1 bg-primary hover:bg-primary/90 text-lg" 
                    onClick={submitTask}
                    disabled={isSubmitting}
                    data-testid="button-submit-task"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Confirm & Create"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Success */}
        {step === "success" && (
          <div className="py-20 flex flex-col items-center justify-center space-y-6 text-center animate-in zoom-in duration-500">
            <div className="h-24 w-24 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="h-12 w-12 text-green-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-serif font-bold text-primary">Task Created!</h2>
              <p className="text-muted-foreground">Redirecting to dashboard...</p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

import { useState, useEffect } from "react";
import { X, Share, Plus, Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Check if already installed as PWA
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches 
      || (window.navigator as any).standalone === true;
    
    if (isStandalone) {
      return; // Already installed, don't show prompt
    }

    // Check if recently dismissed
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      if (Date.now() - dismissedTime < DISMISS_DURATION) {
        return; // Recently dismissed
      }
    }

    // Detect device type
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    const isAndroidDevice = /android/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
    const isMobile = isIOSDevice || isAndroidDevice;

    if (!isMobile) {
      return; // Only show on mobile
    }

    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    // For Android/Chrome, listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // For iOS Safari, show after a short delay
    if (isIOSDevice && isSafari) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000); // Show after 3 seconds
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      };
    }

    // For non-Safari browsers on iOS or other mobile browsers
    if (isMobile && !deferredPrompt) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 5000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setShowPrompt(false);
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom duration-500">
      <Card className="p-4 bg-background/95 backdrop-blur-lg border-primary/20 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
            <Smartphone className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base mb-1">Install Hôtel TaskFlow</h3>
            {isIOS ? (
              <div className="text-sm text-muted-foreground space-y-2">
                <p>Add this app to your home screen for quick access:</p>
                <ol className="list-none space-y-1.5 text-xs">
                  <li className="flex items-center gap-2">
                    <span className="bg-muted rounded-full h-5 w-5 flex items-center justify-center text-xs font-medium">1</span>
                    <span>Tap the <Share className="inline h-4 w-4 mx-0.5" /> Share button</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="bg-muted rounded-full h-5 w-5 flex items-center justify-center text-xs font-medium">2</span>
                    <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="bg-muted rounded-full h-5 w-5 flex items-center justify-center text-xs font-medium">3</span>
                    <span>Tap <strong>"Add"</strong> to confirm</span>
                  </li>
                </ol>
              </div>
            ) : isAndroid && deferredPrompt ? (
              <div className="text-sm text-muted-foreground">
                <p className="mb-3">Install this app for faster access and offline use.</p>
                <Button 
                  size="sm" 
                  onClick={handleInstall}
                  className="gap-2"
                  data-testid="button-install-pwa"
                >
                  <Download className="h-4 w-4" />
                  Install App
                </Button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground space-y-2">
                <p>Add this app to your home screen for quick access:</p>
                <ol className="list-none space-y-1.5 text-xs">
                  <li className="flex items-center gap-2">
                    <span className="bg-muted rounded-full h-5 w-5 flex items-center justify-center text-xs font-medium">1</span>
                    <span>Open browser menu (⋮ or ⋯)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="bg-muted rounded-full h-5 w-5 flex items-center justify-center text-xs font-medium">2</span>
                    <span>Tap <strong>"Add to Home Screen"</strong> or <strong>"Install"</strong></span>
                  </li>
                </ol>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0 -mt-1 -mr-1"
            onClick={handleDismiss}
            data-testid="button-dismiss-pwa-prompt"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

interface SpeechBubbleProps {
    text: string | null;
    visible: boolean;
}

export function SpeechBubble({ text, visible }: SpeechBubbleProps) {
    if (!visible || !text) return null;

    return <div className="speech-bubble">{text}</div>;
}

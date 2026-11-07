import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { SquarePen } from "lucide-react";
import ChatConversation from "../../components/chat/ChatConversation";
import { closePanel, newChat, sendText, setPageListing } from "../../components/chat/chatStore";
import styles from "../../assets/styles/public/Chat.module.css";

// /assistant: the same conversation as the floating help panel, at full
// width. Links in emails and "open as a full page" land here. ?q= sends a
// first message, which is how the home page's question box used to arrive.
export default function Assistant() {
  const [params, setParams] = useSearchParams();
  const sentRef = useRef(false);

  useEffect(() => {
    closePanel();
    setPageListing(null);
  }, []);

  useEffect(() => {
    const q = params.get("q");
    if (!q || sentRef.current) return;
    sentRef.current = true;
    sendText(q.slice(0, 1000));
    setParams({}, { replace: true });
  }, [params, setParams]);

  useEffect(() => {
    document.title = "Assistant";
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Assistant</h1>
          <p className={styles.pageLead}>Answers on deposits, refunds and rules, and help finding a car. Every car and price comes from live listings.</p>
        </div>
        <button type="button" className={styles.newChat} onClick={newChat}>
          <SquarePen size={15} aria-hidden="true" />
          New chat
        </button>
      </div>
      <div className={styles.pageChat}>
        <ChatConversation autoFocus starter />
      </div>
    </div>
  );
}

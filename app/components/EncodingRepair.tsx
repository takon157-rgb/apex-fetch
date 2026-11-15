'use client';

import { useEffect } from 'react';
import { repairMojibake } from '@/lib/encoding-repair';

function repairTextNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE && node.nodeValue) {
    const fixed = repairMojibake(node.nodeValue);
    if (fixed !== node.nodeValue) node.nodeValue = fixed;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_NODE) return;
  const root = node as ParentNode;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(textNode) {
      const parent = textNode.parentElement;
      if (!parent || parent.closest('script,style,textarea,noscript,code,pre')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let textNode: Node | null;
  while ((textNode = walker.nextNode())) {
    const fixed = repairMojibake(textNode.nodeValue || '');
    if (fixed !== textNode.nodeValue) textNode.nodeValue = fixed;
  }
}

/** Repairs legacy mojibake literals already present in server-rendered UI text. */
export default function EncodingRepair() {
  useEffect(() => {
    repairTextNode(document.body);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) repairTextNode(node);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}

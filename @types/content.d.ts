type Scroll = {scrollX: number; scrollY: number};
type MessageData = {disallow: string; caps: unknown; epoch: number; href: string; iconUrl: string; links: Map<string, string>; name: string; openerID: string; pageUrl: string; reload: boolean; result: boolean; scroll: Scroll; title: string; x: number; y: number; isPostData: boolean; postData: unknown};
type ClickJSONData = {
  isTrusted: boolean;
  button: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  href: string | null;
  title: string | null;
  policyContainer: string;
  referrerInfo: string;
  frameID: number;
  triggeringPrincipal: nsIPrincipal | null;
  originAttributes: nsIPrincipal["originAttributes"];
  isContentWindowPrivate: boolean;
  tabmix_openLinkWithHistory: boolean;
  originPrincipal: nsIPrincipal;
  originStoragePrincipal: nsIPrincipal;
  tabmixContentClick: ContentClickResult;
  globalHistoryOptions: {triggeringSponsoredURL: string};

  /** @deprecated - use policyContainer */
  csp: string;
};
type LinkNode = ContentClickLinkElement | LinkNodeUtilsModule.WrappedNode | null;
type ClickMessageData = {json: Partial<ClickJSONData>; href: string | null; node: LinkNode | null};

type ContentClickResult = {
  where: WhereToOpen | "default" | "handled" | "current.frame";
  suppressTabsOnFileDownload: boolean;
  _href: string | null;
  targetAttr: string | null;
};

declare namespace TabmixContentHandlerNS {
  let MESSAGES: string[];
  function init(): void;
  function receiveMessage(params: {name: string; data: MessageData}): void;
  function onDrop(event: DragEvent): void;
}

declare namespace FaviconLoaderNS {
  const actor: JSWindowActorChild;
  function load(params: {iconUrl: string; pageUrl: string}): void;
  function addRootIcon(pageURI: nsIURI): void;
  function onHeadParsed(iconUri: nsIURI, pageUri: nsIURI): void;
}

declare namespace TabmixClickEventHandlerNS {
  interface GlobalThisType extends Omit<typeof globalThis, "addEventListener"> {
    addEventListener(type: string, listener: (this: ContentClickLinkElement, ev: ContentMouseEvent) => unknown, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: TabmixClickEventHandler, options?: boolean | AddEventListenerOptions): void;
  }

  function init(global: GlobalThisType): void;
  function handleEvent(event: ContentMouseEvent): void;
  function getLinkData(event: ContentMouseEvent): ContentClickLinkData;
  function contentAreaClick(event: ContentMouseEvent, linkData: ContentClickLinkData): void;
}

declare namespace ContextMenuHandlerNS {
  function init(global: typeof globalThis): void;
  function prepareContextMenu(event: MouseEvent): void;
}

type TabmixContentHandler = typeof TabmixContentHandlerNS;
type FaviconLoader = typeof FaviconLoaderNS;
type TabmixClickEventHandler = typeof TabmixClickEventHandlerNS;
type ContextMenuHandler = typeof ContextMenuHandlerNS;

declare function addMessageListener(event: string, listener: TabmixContentHandler): void;
declare function sendAsyncMessage(event: string, data: Partial<MessageData> | Partial<ClickJSONData>): void;
declare function sendSyncMessage(messageName?: string | null, obj?: Partial<MessageData> | Partial<ClickMessageData>): unknown[];
declare function sendSyncMessage(messageName: "TabmixContent:Click", obj: ClickMessageData): [ContentClickResult];

interface WebNavigationFrames {
  getFrameId(bc: Window | BrowsingContext): number;
}

declare var ContextMenu: TabmixContextMenu;
declare var WebNavigationFrames: WebNavigationFrames;

interface Document {
  readonly documentURIObject: URI;
  readonly defaultView: WindowProxy;
}

interface mozIDOMWindowProxy {
  windowGlobalChild: WindowGlobalChild;
}

interface nsIDocShell {
  QueryInterface<T extends nsIID>(aIID: T): nsQIResult<T>;
}

interface WindowProxy {
  HTMLAnchorElement: typeof HTMLAnchorElement;
  HTMLLinkElement: typeof HTMLLinkElement;
  HTMLAreaElement: typeof HTMLAreaElement;
  Node: Node;
}

declare var docShell: nsIDocShell;
declare var content: WindowProxy;

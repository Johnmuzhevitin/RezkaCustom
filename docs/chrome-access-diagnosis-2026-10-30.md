# Chrome access diagnosis

Date: 2026-10-30. Scope: the native Windows Computer Use failure blocking verification of the installed Rezka Custom toolbar popup.

## Finding and confidence

**A locale-sensitive document-selection defect is present in the installed official native helper. It is a plausible cause of this machine's URL-confidence failure; its sole runtime causality is not established. Browser access has not been restored.**

A localized Windows interface can expose this failure. The helper prefers a nonempty localized UI Automation control-type name, but subsequently requires that name to equal the English string `document` before retaining the document's URL. A localized name other than `document` therefore excludes a candidate even when its invariant control type is Document.

The failing browser element's actual localized property was not available through the supported native tool. Windows UI culture alone does not prove that property's value. No synthetic predicate test is presented as a reproduction of the live failure.

## Observed environment and symptom

The supported native interface repeatedly stopped before returning window state because it could not confidently determine the browser URL. Machine-specific version, locale, installation and permission inventories are excluded from publication.

## Read-only evidence from this binary

Addresses below refer only to the helper examined during the original diagnosis, with preferred image base `0x140000000`. They are not portable offsets.

| Location | Observed operation | Implication |
| --- | --- | --- |
| `0x14002052b` | Calls `IUIAutomationElement` vtable slot `0x1b0` | Reads `get_CachedLocalizedControlType` |
| `0x140020571`–`0x140020595` | Retains a successful nonempty string and skips fallback | Localized text becomes the semantic role |
| `0x1400205af`, `0x140121933` | Fallback calls slot `0x1a8` | Invariant `get_CachedControlType` is available but used only when the localized value fails or is empty |
| `0x14001c2d6`–`0x14001c2ea` | Compares the selected role with ASCII `document`; skips the URL candidate on mismatch | Localization can prevent retaining a genuine document URL |
| `0x14001c31d` | Also checks `rootwebarea` | The comparison is in root-document URL selection |
| `0x14001a97e` | Chromium-family missing-candidate branch produces state `0x8000000000000002` | The URL remains unavailable to policy validation |
| `0x14007754b` | Missing-URL dispatch loads the observed confidence-error message and returns | This path fails before the later URL-policy HTTP request |

The method slots were independently counted from Microsoft's [UIAutomationClient.h](https://github.com/microsoft/win32metadata/blob/main/generation/WinSDK/RecompiledIdlHeaders/um/UIAutomationClient.h): index 53 / offset `0x1a8` is `get_CachedControlType`; index 54 / offset `0x1b0` is `get_CachedLocalizedControlType`.

Chromium's [UI Automation provider](https://github.com/chromium/chromium/blob/main/ui/accessibility/platform/ax_platform_node_win.cc) allows localized control descriptions and delegates some built-in descriptions to Windows UI Automation. Its current source is supporting context, not a runtime capture or a verified match to this installed Chrome build.

An [existing report in the Codex tracker](https://github.com/openai/codex/issues/45996) independently describes the same defect in other helper versions. It remains open at inspection time and does not provide a confirmed fixed release. These are community reports, not an OpenAI maintainer's confirmation of this machine's root cause.

## Tools and verification boundary

Diagnostic scripts and static disassembly are isolated in `../.scratch/`. `analyze-url-control-flow.py` reads PE bytes and disassembles them without loading or executing the inspected helper. Its target path is specific to the runtime above. Capstone 5.0.3 was installed only under `.scratch/diagnostics-deps`.

Executed checks include the helper hash, signature, Windows UI culture, the localized-role getter and fallback, the document comparison, and the error branch. Example commands, from the project directory:

```powershell
python .scratch/analyze-url-control-flow.py
python .scratch/analyze-url-control-flow.py --function 0x1400204f3 --around 0x14002052b --span 0xc0
python .scratch/analyze-url-control-flow.py --function 0x14001bd46 --around 0x14001c2d6 --span 0x90
```

No installed component, Windows language, URL validation, permission, or browser profile was changed. No alternate native controller was used to access the refused window.

## Required correction and remaining verification

The native component should select document nodes using invariant `UIA_DocumentControlTypeId` (`50030`), keeping localized names for presentation. Actual URL acquisition, root/window association, URL validation and permission checks must remain in place; missing or ambiguous information must still stop access.

The signed helper's source and build pipeline are not part of RezkaCustom. A production correction was not applied. There is no available local source seam for a meaningful regression test of the helper. Any official correction still needs native verification in the user's existing Chrome, including the actual installed extension popup at the current display scale. That acceptance check remains unverified.

## Recovery checks

No verified native-access fix was available during the investigation. A supported helper update or new diagnostic evidence is needed before repeating the attempt. No browser permission checks, language settings or installed helper were changed.

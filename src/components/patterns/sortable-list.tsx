"use client";

/**
 * SortableList and SortableRow: rows the reader can reorder, by dragging or with buttons.
 * Purpose: photo order, floor-plan order, form-field order in the portals. Owner: design system.
 *   Built on dnd-kit. The Move up and Move down buttons are the keyboard and touch alternative to
 *   dragging (WCAG 2.2 criterion 2.5.7), so every order can be changed without a drag.
 * Props: SortableList: ids (the current order), onReorder(ids) (called with the new order; the
 *   caller stores it), className, children (SortableRows in the same order as ids). SortableRow: id,
 *   labels ({ drag, moveUp, moveDown }, already-translated and naming the row, e.g. "Move kitchen
 *   photo up"), children (the row content), className.
 * Responsive: the grip and both buttons are 44 px targets on every screen.
 * Accessibility: the grip is a button: Space picks up, arrow keys move, Space drops, Escape
 *   cancels. dnd-kit announces these steps in English; pass `accessibility` to SortableList when a
 *   second language is added. The up button is disabled on the first row and the down button on the
 *   last. Focus stays on a button after it moves its row.
 * States: resting, dragging, first, last. Dependencies: dnd-kit, IconButton, Icon, cn.
 * Tests: sortable.test.tsx; Design Lab "Card parts" (S2-T07).
 * UX reference: ds-components, sortable row (post-property photos step).
 */
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DndContextProps,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";

type SortableContextValue = { ids: string[]; onReorder: (ids: string[]) => void };
const SortableListContext = createContext<SortableContextValue | null>(null);

type SortableListProps = {
  ids: string[];
  onReorder: (ids: string[]) => void;
  children: ReactNode;
  className?: string;
  accessibility?: DndContextProps["accessibility"];
};

function SortableList({ ids, onReorder, children, className, accessibility }: SortableListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) onReorder(arrayMove(ids, from, to));
  }

  return (
    <SortableListContext.Provider value={{ ids, onReorder }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        {...(accessibility ? { accessibility } : {})}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul data-slot="sortable-list" className={cn("flex flex-col gap-3", className)}>
            {children}
          </ul>
        </SortableContext>
      </DndContext>
    </SortableListContext.Provider>
  );
}

type SortableRowProps = {
  id: string;
  labels: { drag: string; moveUp: string; moveDown: string };
  children: ReactNode;
  className?: string;
};

function SortableRow({ id, labels, children, className }: SortableRowProps) {
  const list = useContext(SortableListContext);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const index = list ? list.ids.indexOf(id) : -1;
  const last = list ? list.ids.length - 1 : -1;

  function move(offset: number) {
    if (list) list.onReorder(arrayMove(list.ids, index, index + offset));
  }

  return (
    <li
      ref={setNodeRef}
      data-slot="sortable-row"
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-line bg-surface py-2 pr-2 pl-1",
        isDragging && "relative z-sticky shadow-hover",
        className,
      )}
    >
      <IconButton
        ref={setActivatorNodeRef}
        aria-label={labels.drag}
        className="cursor-grab touch-none text-muted active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <Icon icon={GripVertical} />
      </IconButton>
      <div className="min-w-0 flex-1">{children}</div>
      <IconButton aria-label={labels.moveUp} disabled={index <= 0} onClick={() => move(-1)}>
        <Icon icon={ChevronUp} />
      </IconButton>
      <IconButton aria-label={labels.moveDown} disabled={index === last} onClick={() => move(1)}>
        <Icon icon={ChevronDown} />
      </IconButton>
    </li>
  );
}

export { SortableList, SortableRow };

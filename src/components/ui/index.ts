/**
 * Standard UI components. Screens compose these instead of styling raw elements, so spacing,
 * radius, colour and type stay consistent. Rules:
 *  - No decorative icons. Actions are verbs, statuses are words, tone is colour.
 *  - One <Card> level; group inside it with spacing, <Well> or <Divider>.
 *  - Form controls always sit in a <Field>.
 *  - One primary <Button> per view.
 * A live reference of every component is at /styleguide.
 */
export { Button, TextButton, type ButtonProps, type ButtonVariant, type ButtonSize } from "./button";
export { Spinner } from "./spinner";
export { Tag, scoreTone, type Tone } from "./tag";
export { Card, CardHeader, CardBody, CardToolbar, Well, Divider } from "./card";
export { Field, Input, Textarea, Select, Counter } from "./field";
export { SegmentedControl, Tabs, CheckRow, type Option } from "./choice";
export { Notice, EmptyState, Working } from "./feedback";
export { ScoreDial, Meter, Stat, Table, MarkedList } from "./data";
export { CopyButton } from "./copy-button";

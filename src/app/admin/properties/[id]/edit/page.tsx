import PropertyEditor from '@/components/admin/PropertyEditor';
export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  return <PropertyEditor propertyId={(await params).id} />;
}

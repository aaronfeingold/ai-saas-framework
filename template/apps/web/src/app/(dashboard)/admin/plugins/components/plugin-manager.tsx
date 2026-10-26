'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  Download,
  Eye,
  Package,
  Plus,
  Settings,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type DomainConfig, pluginRegistry } from '@/lib/plugin-registry';

export function PluginManager() {
  const [plugins, setPlugins] = useState<DomainConfig[]>([]);
  const [activePluginId, setActivePluginId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<DomainConfig | null>(
    null
  );
  const [importConfig, setImportConfig] = useState('');

  const loadDefaultPlugins = useCallback(async () => {
    const eventManagementConfig: DomainConfig = {
      id: 'event-management',
      name: 'Event Management',
      description:
        'Complete event management platform with venues, artists, and ticketing',
      version: '1.0.0',
      author: 'System',
      contentTypes: [
        {
          id: 'event',
          name: 'Event',
          description: 'Events and performances',
          icon: '🎪',
          category: 'Events',
          fields: [
            {
              name: 'title',
              type: 'text',
              label: 'Event Title',
              required: true,
            },
            {
              name: 'description',
              type: 'textarea',
              label: 'Description',
              required: true,
            },
            { name: 'date', type: 'date', label: 'Event Date', required: true },
            { name: 'venue', type: 'select', label: 'Venue', required: true },
            {
              name: 'artist',
              type: 'multiselect',
              label: 'Artists',
              required: false,
            },
            {
              name: 'ticketPrice',
              type: 'number',
              label: 'Ticket Price',
              required: true,
            },
            {
              name: 'capacity',
              type: 'number',
              label: 'Capacity',
              required: true,
            },
          ],
        },
        {
          id: 'venue',
          name: 'Venue',
          description: 'Event venues and locations',
          icon: '🏟️',
          category: 'Venues',
          fields: [
            { name: 'name', type: 'text', label: 'Venue Name', required: true },
            {
              name: 'address',
              type: 'textarea',
              label: 'Address',
              required: true,
            },
            {
              name: 'capacity',
              type: 'number',
              label: 'Maximum Capacity',
              required: true,
            },
            { name: 'website', type: 'url', label: 'Website', required: false },
            {
              name: 'contact',
              type: 'email',
              label: 'Contact Email',
              required: true,
            },
          ],
        },
        {
          id: 'artist',
          name: 'Artist',
          description: 'Performers and artists',
          icon: '🎤',
          category: 'Artists',
          fields: [
            {
              name: 'name',
              type: 'text',
              label: 'Artist Name',
              required: true,
            },
            {
              name: 'bio',
              type: 'textarea',
              label: 'Biography',
              required: false,
            },
            { name: 'genre', type: 'select', label: 'Genre', required: true },
            { name: 'website', type: 'url', label: 'Website', required: false },
            {
              name: 'socialMedia',
              type: 'textarea',
              label: 'Social Media Links',
              required: false,
            },
          ],
        },
      ],
      aiPrompts: {
        eventDescription: {
          system:
            'You are an expert event marketing copywriter. Generate compelling event descriptions that highlight key details and encourage attendance.',
          temperature: 0.8,
          maxTokens: 500,
        },
        venueRecommendation: {
          system:
            'You are a venue consultant. Recommend suitable venues based on event requirements like capacity, location, and type.',
          temperature: 0.6,
          maxTokens: 300,
        },
      },
      ui: {
        theme: {
          primary: '#8b5cf6',
          secondary: '#a78bfa',
          accent: '#c4b5fd',
        },
        navigation: [
          { label: 'Events', href: '/admin/content/event', icon: '🎪' },
          { label: 'Venues', href: '/admin/content/venue', icon: '🏟️' },
          { label: 'Artists', href: '/admin/content/artist', icon: '🎤' },
        ],
      },
    };

    const ecommerceConfig: DomainConfig = {
      id: 'ecommerce',
      name: 'E-commerce Platform',
      description:
        'Complete e-commerce solution with products, orders, and customers',
      version: '1.0.0',
      author: 'System',
      contentTypes: [
        {
          id: 'product',
          name: 'Product',
          description: 'Products and merchandise',
          icon: '📦',
          category: 'Catalog',
          fields: [
            {
              name: 'name',
              type: 'text',
              label: 'Product Name',
              required: true,
            },
            {
              name: 'description',
              type: 'textarea',
              label: 'Description',
              required: true,
            },
            { name: 'price', type: 'number', label: 'Price', required: true },
            {
              name: 'category',
              type: 'select',
              label: 'Category',
              required: true,
            },
            { name: 'sku', type: 'text', label: 'SKU', required: true },
            {
              name: 'inventory',
              type: 'number',
              label: 'Stock Level',
              required: true,
            },
          ],
        },
        {
          id: 'category',
          name: 'Category',
          description: 'Product categories',
          icon: '📁',
          category: 'Catalog',
          fields: [
            {
              name: 'name',
              type: 'text',
              label: 'Category Name',
              required: true,
            },
            {
              name: 'description',
              type: 'textarea',
              label: 'Description',
              required: false,
            },
            {
              name: 'parentCategory',
              type: 'select',
              label: 'Parent Category',
              required: false,
            },
          ],
        },
      ],
      aiPrompts: {
        productDescription: {
          system:
            'You are an expert e-commerce copywriter. Create compelling product descriptions that highlight features, benefits, and encourage purchases.',
          temperature: 0.7,
          maxTokens: 400,
        },
      },
      ui: {
        theme: {
          primary: '#059669',
          secondary: '#10b981',
          accent: '#34d399',
        },
      },
    };

    try {
      await pluginRegistry.loadPlugin(eventManagementConfig);
      await pluginRegistry.loadPlugin(ecommerceConfig);
      pluginRegistry.setActivePlugin('event-management');
      await loadPlugins();
      toast.success('Default plugins loaded successfully');
    } catch (error) {
      console.error('Error loading default plugins:', error);
      toast.error('Failed to load default plugins');
    }
  }, []);

  const loadPlugins = useCallback(async () => {
    try {
      const allPlugins = pluginRegistry.getAllPlugins();
      const activePlugin = pluginRegistry.getActivePlugin();

      setPlugins(allPlugins);
      setActivePluginId(activePlugin?.id || null);

      // Load default plugins if none exist
      if (allPlugins.length === 0) {
        await loadDefaultPlugins();
      }
    } catch (error) {
      console.error('Error loading plugins:', error);
      toast.error('Failed to load plugins');
    } finally {
      setLoading(false);
    }
  }, [loadDefaultPlugins]);

  useEffect(() => {
    loadPlugins();
  }, [loadPlugins]);

  const handleActivatePlugin = async (pluginId: string) => {
    try {
      const success = pluginRegistry.setActivePlugin(pluginId);
      if (success) {
        setActivePluginId(pluginId);
        toast.success('Plugin activated successfully');
        window.location.reload(); // Reload to apply new configuration
      } else {
        toast.error('Failed to activate plugin');
      }
    } catch (error) {
      console.error('Error activating plugin:', error);
      toast.error('Failed to activate plugin');
    }
  };

  const handleDeletePlugin = async (pluginId: string) => {
    try {
      const success = pluginRegistry.unloadPlugin(pluginId);
      if (success) {
        await loadPlugins();
        toast.success('Plugin deleted successfully');
      } else {
        toast.error('Failed to delete plugin');
      }
    } catch (error) {
      console.error('Error deleting plugin:', error);
      toast.error('Failed to delete plugin');
    }
  };

  const handleImportPlugin = async () => {
    try {
      if (!importConfig.trim()) {
        toast.error('Please enter a valid configuration');
        return;
      }

      await pluginRegistry.importConfig(importConfig);
      await loadPlugins();
      setImportConfig('');
      setImportDialogOpen(false);
      toast.success('Plugin imported successfully');
    } catch (error) {
      console.error('Error importing plugin:', error);
      toast.error('Failed to import plugin: Invalid configuration');
    }
  };

  const handleExportPlugin = async (pluginId: string) => {
    try {
      const configJson = await pluginRegistry.exportConfig(pluginId);
      const blob = new Blob([configJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${pluginId}-config.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Plugin configuration exported');
    } catch (error) {
      console.error('Error exporting plugin:', error);
      toast.error('Failed to export plugin');
    }
  };

  const handleViewPlugin = (plugin: DomainConfig) => {
    setSelectedPlugin(plugin);
    setViewDialogOpen(true);
  };

  if (loading) {
    return <div className="py-8 text-center">Loading plugins...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-semibold">Installed Plugins</h2>
          <Badge variant="outline">
            {plugins.length} plugin{plugins.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Import Plugin Configuration</DialogTitle>
                <DialogDescription>
                  Paste your plugin configuration JSON below
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="config">Configuration JSON</Label>
                  <Textarea
                    id="config"
                    placeholder="Paste plugin configuration here..."
                    value={importConfig}
                    onChange={(e) => setImportConfig(e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setImportDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleImportPlugin}>Import Plugin</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button size="sm" onClick={loadDefaultPlugins}>
            <Plus className="mr-2 h-4 w-4" />
            Load Defaults
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plugins.map((plugin) => (
          <Card
            key={plugin.id}
            className={`relative ${
              activePluginId === plugin.id ? 'ring-primary ring-2' : ''
            }`}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {plugin.name}
                </CardTitle>
                {activePluginId === plugin.id && (
                  <Badge variant="default">Active</Badge>
                )}
              </div>
              <CardDescription>{plugin.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-muted-foreground text-sm">
                <div>Version: {plugin.version}</div>
                <div>Author: {plugin.author}</div>
                <div>Content Types: {plugin.contentTypes.length}</div>
              </div>

              <div className="flex flex-wrap gap-2">
                {plugin.contentTypes.slice(0, 3).map((type) => (
                  <Badge key={type.id} variant="secondary" className="text-xs">
                    {type.icon} {type.name}
                  </Badge>
                ))}
                {plugin.contentTypes.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{plugin.contentTypes.length - 3} more
                  </Badge>
                )}
              </div>

              <div className="flex gap-2">
                {activePluginId !== plugin.id && (
                  <Button
                    size="sm"
                    onClick={() => handleActivatePlugin(plugin.id)}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Activate
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleViewPlugin(plugin)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportPlugin(plugin.id)}
                >
                  <Download className="h-4 w-4" />
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeletePlugin(plugin.id)}
                  disabled={activePluginId === plugin.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {plugins.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Package className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-semibold">No plugins installed</h3>
            <p className="text-muted-foreground mb-4">
              Import a plugin configuration or load the default plugins to get
              started.
            </p>
            <Button onClick={loadDefaultPlugins}>
              <Plus className="mr-2 h-4 w-4" />
              Load Default Plugins
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Plugin Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {selectedPlugin?.name}
            </DialogTitle>
            <DialogDescription>{selectedPlugin?.description}</DialogDescription>
          </DialogHeader>
          {selectedPlugin && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium">Version</Label>
                  <div className="text-muted-foreground text-sm">
                    {selectedPlugin.version}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Author</Label>
                  <div className="text-muted-foreground text-sm">
                    {selectedPlugin.author}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Content Types</Label>
                <div className="mt-2 space-y-2">
                  {selectedPlugin.contentTypes.map((type) => (
                    <div
                      key={type.id}
                      className="flex items-center gap-2 rounded-lg border p-2"
                    >
                      <span>{type.icon}</span>
                      <div>
                        <div className="font-medium">{type.name}</div>
                        <div className="text-muted-foreground text-sm">
                          {type.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">AI Prompts</Label>
                <div className="mt-2 space-y-2">
                  {Object.entries(selectedPlugin.aiPrompts).map(
                    ([key, prompt]) => (
                      <div key={key} className="rounded-lg border p-2">
                        <div className="font-medium">{key}</div>
                        <div className="text-muted-foreground text-sm">
                          Temperature: {prompt.temperature}, Max Tokens:{' '}
                          {prompt.maxTokens}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

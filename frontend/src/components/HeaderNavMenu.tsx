import React from 'react';
import { Dropdown, Menu, Space } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { workflowGroups, UtilityFeature } from '../config/navigationConfig';
import './HeaderNavMenu.css';

interface HeaderNavMenuProps {
    onNavigate: (path: string) => void;
}

export const HeaderNavMenu: React.FC<HeaderNavMenuProps> = ({ onNavigate }) => {

    // Recursive helper to render menu items
    const renderMenuItems = (features: UtilityFeature[], groupColor: string) => {
        return features.map((feature) => {
            if (feature.subPages && feature.subPages.length > 0) {
                return (
                    <Menu.SubMenu
                        key={feature.key}
                        icon={
                            <span
                                className="nav-feature-icon-small"
                                style={{ color: groupColor, backgroundColor: `${groupColor}15` }}
                            >
                                {feature.icon}
                            </span>
                        }
                        title={<span className="nav-feature-title">{feature.name}</span>}
                        popupClassName="header-nav-submenu-popup"
                    >
                        {feature.subPages.map((subPage) => (
                            <Menu.Item key={subPage.path} onClick={() => onNavigate(subPage.path)}>
                                <span className="nav-subfeature-title">{subPage.name}</span>
                            </Menu.Item>
                        ))}
                    </Menu.SubMenu>
                );
            }

            return (
                <Menu.Item key={feature.path} onClick={() => onNavigate(feature.path)} className="nav-feature-menu-item">
                    <div className="nav-feature-item">
                        <div
                            className="nav-feature-icon-wrapper"
                            style={{ color: groupColor, backgroundColor: `${groupColor}10` }}
                        >
                            {feature.icon}
                        </div>
                        <div className="nav-feature-content">
                            <div className="nav-feature-name">{feature.name}</div>
                            {feature.tagline && (
                                <div className="nav-feature-tagline">{feature.tagline}</div>
                            )}
                        </div>
                    </div>
                </Menu.Item>
            );
        });
    };

    return (
        <div className="header-nav-menu">
            {workflowGroups.map((group, index) => {
                const menu = (
                    <Menu className="header-nav-dropdown-menu">
                        {renderMenuItems(group.features, group.accentColor || '#3b82f6')}
                    </Menu>
                );

                return (
                    <div key={group.key} className="nav-group-wrapper">
                        <Dropdown
                            overlay={menu}
                            trigger={['hover']}
                            overlayClassName="header-nav-dropdown-overlay"
                        >
                            <div className="header-nav-dropdown-trigger">
                                <span className="nav-group-icon" style={{ color: group.accentColor }}>
                                    {group.icon}
                                </span>
                                <span className="nav-group-name">{group.shortName || group.name}</span>
                                <DownOutlined style={{ fontSize: '10px', opacity: 0.5 }} />
                            </div>
                        </Dropdown>
                        {index < workflowGroups.length - 1 && (
                            <div className="nav-group-divider" />
                        )}
                    </div>
                );
            })}
        </div>
    );
};
